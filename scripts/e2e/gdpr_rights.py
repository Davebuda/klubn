"""E2E — P0-WS3C GDPR operationalization.

Drives the LIVE GraphQL endpoint and asserts the GDPR rights invariants, then checks DB TRUTH:

  signup_requires_consent
    register WITHOUT acceptTerms -> rejected (no user row);
    register WITH acceptTerms=true -> ok, and the ApplicationUsers row carries
    TermsAcceptedAt + TermsVersion. marketingOptIn=true stamps MarketingOptIn separately.

  self_export_owner_scoped
    exportMyData (JWT-scoped, NO id param) returns the caller's own profile + tickets + orders.

  erasure_anonymizes_keeps_payments
    seed user + Order + Payment + Ticket (direct INSERT); call requestErasure;
    assert the user's Email is anonymized (anonymized+...@deleted.invalid) AND the
    Order / Payment / Ticket rows STILL EXIST (financial retention).

  non_admin_cannot_export_others
    exportMyData is JWT-scoped — B's export returns B's data, never A's (there is no id arg).

Run (needs a FRESH SQLite DB + the backend running against it, Staging + --no-launch-profile
so consent enforcement runs outside Development just like dos_limits.py — see README):

    # 1. start the backend against the disposable e2e DB:
    #    ConnectionStrings__DefaultConnection="Data Source=DJDIP_e2e.db" \
    #    ASPNETCORE_ENVIRONMENT=Staging ASPNETCORE_URLS=http://localhost:5102 \
    #    Payments__Provider=Sandbox Payments__Providers=Sandbox \
    #    Sandbox__WebhookSecret=sandbox-webhook-secret \
    #    Jwt__Key=... Qr__SigningSecret=... ADMIN_EMAIL=... ADMIN_DEFAULT_PASSWORD=... \
    #    dotnet run --project DJDiP.csproj --no-launch-profile
    # 2. then, from scripts/e2e/:
    #    python gdpr_rights.py
"""
import uuid

import _harness as h


def _denied(resp) -> bool:
    """A GraphQL response carries an Access-denied / auth-required error. A VALIDATION error
    (unknown field/arg) is a bug in THIS script — raise loudly rather than masquerade as a pass."""
    errs = resp.get("errors") or []
    if not errs:
        return False
    blob = " ".join((e.get("message") or "") for e in errs).lower()
    if ("does not exist on the type" in blob or "does not exist on type" in blob
            or "unknown field" in blob or "unknown argument" in blob):
        raise AssertionError(
            "GraphQL validation error in a test query (fix the query, not the app): "
            + str([e.get("message") for e in errs]))
    return ("access denied" in blob or "authentication required" in blob
            or "must accept the terms" in blob)


def _register_raw(email: str, accept_terms, marketing=False):
    """Register sending an explicit acceptTerms (may be False to prove enforcement)."""
    i = {"fullName": "GDPR Tester", "email": email, "password": "E2e!TestPass123",
         "marketingOptIn": marketing}
    if accept_terms is not None:
        i["acceptTerms"] = accept_terms
    return h.gql("""mutation($i: RegisterInput!) {
      register(input: $i) { accessToken user { id email } } }""", {"i": i})


def user_row(user_id: str):
    con = h.db()
    try:
        return con.execute(
            """SELECT Email, FullName, TermsAcceptedAt, TermsVersion,
                      MarketingOptIn, MarketingOptInAt FROM ApplicationUsers WHERE Id = ?""",
            (user_id,)).fetchone()
    finally:
        con.close()


def seed_order_payment_ticket(event_id: str, user_id: str):
    """Direct-INSERT an Order + Payment + Ticket owned by user_id (financial rows that erasure
    must RETAIN). Returns (order_id, payment_id, ticket_id)."""
    oid = str(uuid.uuid4()).upper()
    pid = str(uuid.uuid4()).upper()
    tid = str(uuid.uuid4()).upper()
    ref = "klubn-gdpr-" + uuid.uuid4().hex[:8]
    con = h.db()
    try:
        con.execute(
            """INSERT INTO Orders (Id,UserId,OrderDate,TotalAmount,Status,Reference,DiscountMinor)
               VALUES (?,?,?,?,?,?,?)""",
            (oid, user_id, "2026-01-01 00:00:00", 100, h.ORD_FULFILLED, ref, 0))
        con.execute(
            """INSERT INTO Payments
               (Id,OrderId,Amount,Currency,PaymentMethod,PaymentDate,Status,Provider,
                ProviderReference,AuthorizedAmountMinor,CapturedAmountMinor,RefundedAmountMinor,AttemptNo)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, oid, 100, "NOK", "Sandbox", "2026-01-01 00:00:00", h.PAY_CAPTURED,
             "Sandbox", ref, 10000, 10000, 0, 1))
        con.execute(
            """INSERT INTO Tickets
               (Id,EventId,UserId,TicketNumber,QRCode,AdmitCount,AdmitsRemaining,
                BasePrice,VATRate,VATAmount,TotalPrice,IsValid,IsUsed,Status,PurchaseDate,TermsAccepted)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tid, event_id, user_id, "TKT-GDPR-" + uuid.uuid4().hex[:6].upper(),
             "QR-" + uuid.uuid4().hex.upper(), 1, 1, 0, "0.12", 0, 0, 1, 0, 0,
             "2026-01-01 00:00:00", 1))
        con.commit()
    finally:
        con.close()
    return oid, pid, tid


def row_exists(table: str, row_id: str) -> bool:
    con = h.db()
    try:
        return con.execute(f"SELECT 1 FROM {table} WHERE Id = ?", (row_id,)).fetchone() is not None
    finally:
        con.close()


Q_EXPORT = """query {
  exportMyData {
    profile { id email termsAcceptedAt termsVersion marketingOptIn }
    tickets { id ticketNumber }
    orders { id reference }
  }
}"""
M_ERASURE = "mutation { requestErasure }"


def main():
    c = h.cfg()
    L = h.Ledger("gdpr_rights")

    # ===== signup_requires_consent ============================================
    no_terms_email = f"gdpr-noterms-{uuid.uuid4().hex[:8]}@test.local"
    r = _register_raw(no_terms_email, accept_terms=False)
    L.check("register without acceptTerms -> rejected", _denied(r), str(r)[:200])
    # ...and no user row was created.
    con = h.db()
    try:
        exists = con.execute("SELECT 1 FROM ApplicationUsers WHERE Email = ?",
                             (no_terms_email,)).fetchone() is not None
    finally:
        con.close()
    L.check("register without acceptTerms -> no user row", not exists)

    # acceptTerms=true + marketing opt-in -> consent stamped, marketing stamped separately.
    ok_email = f"gdpr-ok-{uuid.uuid4().hex[:8]}@test.local"
    r = _register_raw(ok_email, accept_terms=True, marketing=True)
    uid = (((r.get("data") or {}).get("register") or {}).get("user") or {}).get("id")
    L.check("register with acceptTerms -> ok", bool(uid), str(r)[:200])
    if uid:
        row = user_row(uid)
        L.check("TermsAcceptedAt stored", row and row["TermsAcceptedAt"] is not None)
        L.check("TermsVersion stored", row and bool(row["TermsVersion"]))
        L.check("MarketingOptIn stored separately (=1)", row and row["MarketingOptIn"] == 1)

    # terms-only register leaves marketing false (separation of consent).
    terms_only_email = f"gdpr-termsonly-{uuid.uuid4().hex[:8]}@test.local"
    r = _register_raw(terms_only_email, accept_terms=True, marketing=False)
    uid_to = (((r.get("data") or {}).get("register") or {}).get("user") or {}).get("id")
    if uid_to:
        row = user_row(uid_to)
        L.check("terms-only -> MarketingOptIn=0", row and row["MarketingOptIn"] == 0)

    # ===== self_export_owner_scoped ===========================================
    tokA, uidA, emailA = h.register_user("gdprA")
    oidA, pidA, tidA = seed_order_payment_ticket(c.event_id, uidA)

    exp = h.gql(Q_EXPORT, token=tokA)
    data = (exp.get("data") or {}).get("exportMyData") or {}
    prof = data.get("profile") or {}
    L.check("exportMyData returns caller profile",
            prof.get("id") == uidA and (prof.get("email") or "").lower() == emailA.lower(),
            str(exp)[:200])
    order_ids = {str(o.get("id")).lower() for o in (data.get("orders") or [])}
    ticket_ids = {str(t.get("id")).lower() for t in (data.get("tickets") or [])}
    L.check("export includes caller's order", oidA.lower() in order_ids, str(order_ids)[:200])
    L.check("export includes caller's ticket", tidA.lower() in ticket_ids, str(ticket_ids)[:200])

    # anonymous export -> denied (JWT required).
    r = h.gql(Q_EXPORT)
    L.check("exportMyData anonymous -> denied", _denied(r), str(r)[:200])

    # ===== non_admin_cannot_export_others =====================================
    tokB, uidB, emailB = h.register_user("gdprB")
    _, _, tidB = seed_order_payment_ticket(c.event_id, uidB)
    expB = h.gql(Q_EXPORT, token=tokB)
    dataB = (expB.get("data") or {}).get("exportMyData") or {}
    profB = dataB.get("profile") or {}
    # B's export is B's data only — there is no id arg to request A's data.
    bticket_ids = {str(t.get("id")).lower() for t in (dataB.get("tickets") or [])}
    L.check("B export -> B's own profile", profB.get("id") == uidB)
    L.check("B export never contains A's ticket", tidA.lower() not in bticket_ids)

    # ===== erasure_anonymizes_keeps_payments ==================================
    tokE, uidE, emailE = h.register_user("gdprErase")
    oidE, pidE, tidE = seed_order_payment_ticket(c.event_id, uidE)

    r = h.gql(M_ERASURE, token=tokE)
    erased = ((r.get("data") or {}).get("requestErasure"))
    L.check("requestErasure -> true", erased is True, str(r)[:200])

    row = user_row(uidE)
    email_after = (row["Email"] if row else "") or ""
    L.check("erasure anonymizes Email",
            email_after.startswith("anonymized+") and email_after.endswith("@deleted.invalid"),
            email_after)
    L.check("erasure scrubs FullName", row and row["FullName"] == "Deleted user")

    # Financial rows RETAINED.
    L.check("Order retained after erasure", row_exists("Orders", oidE))
    L.check("Payment retained after erasure", row_exists("Payments", pidE))
    L.check("Ticket retained after erasure", row_exists("Tickets", tidE))

    # An audit row was written (actor==target for self-erasure).
    con = h.db()
    try:
        arow = con.execute(
            "SELECT UserId FROM AuditLogs WHERE Action='UserErasure' AND EntityId=?",
            (uidE,)).fetchone()
    finally:
        con.close()
    L.check("erasure writes UserErasure audit row (actor==target)",
            arow is not None and arow["UserId"] == uidE)

    # requestErasure anonymous -> denied.
    r = h.gql(M_ERASURE)
    L.check("requestErasure anonymous -> denied", _denied(r), str(r)[:200])

    L.done()


if __name__ == "__main__":
    main()
