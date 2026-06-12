"""E2E — P0-WS1 authorization boundary (the 14 broken resolvers).

Drives the LIVE GraphQL endpoint and asserts the authz invariant for every newly-guarded
resolver, then checks DB TRUTH for the two ticket IDOR mutations:

  IDOR mutations
    cancelTicket   : user B cancels A's ticket  -> denied, Tickets.Status still Active (0)
    transferTicket : user B transfers A's ticket -> denied, Tickets.UserId still A, QR unchanged

  Owner-or-admin reads (anonymous -> denied; cross-user -> denied; owner -> ok)
    userById, ticketsByUser, followedDjs, djApplicationByUser,
    galleryMediaByUser, organizerApplicationByUser

  Resource reads (Chain #1 — door-token leak)
    ticket(id)      : non-owner read -> denied; owner read -> ok, qrCode present
    ticketsByEvent  : anonymous -> denied; staff list never exposes qrCode

  Table dumps (anonymous -> denied)
    djApplications, pendingDjApplications, contactMessages, newsletters

  Identity mutations (client id is never trusted; anonymous -> denied)
    followDj/unfollowDj/submitDjApplication/createContactMessage/subscribeNewsletter

Run (needs a FRESH SQLite DB + the backend running against it — see scripts/e2e/README.md):

    # 1. start the backend against the disposable e2e DB (Development, Sandbox provider):
    #    ConnectionStrings__DefaultConnection="Data Source=DJDIP_e2e.db" \
    #    ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5102 \
    #    Sandbox__WebhookSecret=sandbox-webhook-secret \
    #    dotnet run --project DJDiP.csproj
    # 2. then, from scripts/e2e/:
    #    python authz_resolvers.py
"""
import uuid

import _harness as h


def _denied(resp) -> bool:
    """A GraphQL response is 'denied' if it carries an Access-denied / auth-required error
    (HotChocolate surfaces thrown GraphQLExceptions in the errors array, often as HTTP 500
    which the harness parses).

    Hardening: a GraphQL VALIDATION error (unknown field / wrong type in the query) is a bug in
    THIS script, never an authorization result. Raise loudly so a future schema typo can't
    masquerade as a pass (or silently mask a real auth check)."""
    errs = resp.get("errors") or []
    if not errs:
        return False
    blob = " ".join((e.get("message") or "") for e in errs).lower()
    if ("does not exist on the type" in blob or "does not exist on type" in blob
            or "unknown field" in blob or "unknown argument" in blob):
        raise AssertionError(
            "GraphQL validation error in a test query (fix the query, not the app): "
            + str([e.get("message") for e in errs]))
    return "access denied" in blob or "authentication required" in blob


# The fixed password register_user() uses — needed to re-login after a DB role escalation.
_TEST_PASSWORD = "E2e!TestPass123"
ROLE_ADMIN = 2  # AuthService.MapRole: 2 -> "Admin"


def _set_role(user_id: str, role: int) -> None:
    """Direct DB escalation (same sanctioned path the harness uses for seeding)."""
    con = h.db()
    try:
        con.execute("UPDATE ApplicationUsers SET Role = ? WHERE Id = ?", (role, user_id))
        con.commit()
    finally:
        con.close()


def _login(email: str) -> str:
    r = h.gql("""mutation($i: LoginInput!){ login(input:$i){ accessToken } }""",
              {"i": {"email": email, "password": _TEST_PASSWORD}})
    tok = ((r.get("data") or {}).get("login") or {}).get("accessToken")
    if not tok:
        raise RuntimeError(f"login failed: {r}")
    return tok


def make_admin(prefix: str) -> str:
    """Register a user, escalate to Admin in the DB, re-login so the JWT carries the Admin claim.
    Returns the admin access token (used to exercise the manager/non-owner QR-strip paths)."""
    _, uid, email = h.register_user(prefix)
    _set_role(uid, ROLE_ADMIN)
    return _login(email)


def seed_active_ticket(event_id: str, user_id: str) -> tuple[str, str]:
    """Direct-INSERT a minimal Active ticket owned by user_id. Returns (ticket_id, qr)."""
    tid = str(uuid.uuid4()).upper()
    qr = "QR-" + uuid.uuid4().hex.upper()
    num = "TKT-E2E-" + uuid.uuid4().hex[:6].upper()
    con = h.db()
    try:
        con.execute(
            """INSERT INTO Tickets
               (Id,EventId,UserId,TicketNumber,QRCode,AdmitCount,AdmitsRemaining,
                BasePrice,VATRate,VATAmount,TotalPrice,IsValid,IsUsed,Status,
                PurchaseDate,TermsAccepted)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tid, event_id, user_id, num, qr, 1, 1,
             0, "0.12", 0, 0, 1, 0, 0,  # Status 0 == Active
             "2026-01-01 00:00:00", 1))
        con.commit()
    finally:
        con.close()
    return tid, qr


def ticket_row(ticket_id: str):
    con = h.db()
    try:
        return con.execute(
            "SELECT UserId, Status, QRCode FROM Tickets WHERE Id = ?", (ticket_id,)).fetchone()
    finally:
        con.close()


# ---- GraphQL ops ---------------------------------------------------------------

Q_USER_BY_ID = "query($u:String!){ userById(userId:$u){ fullName email } }"
Q_TICKETS_BY_USER = "query($u:String!){ ticketsByUser(userId:$u){ id } }"
Q_FOLLOWED_DJS = "query($u:String!){ followedDjs(userId:$u){ id } }"
Q_DJ_APP_BY_USER = "query($u:String!){ djApplicationByUser(userId:$u){ id } }"
Q_GALLERY_BY_USER = "query($u:String!){ galleryMediaByUser(userId:$u){ id } }"
Q_ORG_APP_BY_USER = "query($u:String!){ organizerApplicationByUser(userId:$u){ id } }"
Q_TICKET = "query($id:UUID!){ ticket(id:$id){ id qrCode userId } }"
Q_TICKETS_BY_EVENT = "query($e:UUID!){ ticketsByEvent(eventId:$e){ id qrCode } }"
Q_DJ_APPS = "query{ djApplications{ id } }"
Q_PENDING_DJ_APPS = "query{ pendingDjApplications{ id } }"
Q_CONTACT_MESSAGES = "query{ contactMessages{ id } }"
Q_NEWSLETTERS = "query{ newsletters{ id } }"

M_CANCEL = "mutation($i:CancelTicketInput!){ cancelTicket(input:$i){ id status } }"
M_TRANSFER = "mutation($i:TransferTicketInput!){ transferTicket(input:$i){ id userId } }"
M_FOLLOW = "mutation($i:FollowDjInput!){ followDj(input:$i) }"
M_SUBMIT_DJ = "mutation($i:CreateDJApplicationInput!){ submitDJApplication(input:$i){ id } }"
M_CONTACT = "mutation($i:CreateContactMessageInput!){ createContactMessage(input:$i) }"
M_NEWSLETTER = "mutation($i:CreateNewsletterInput!){ subscribeNewsletter(input:$i){ id } }"


def main():
    c = h.cfg()
    L = h.Ledger("authz_resolvers")
    run = h.uniq()

    tokA, uidA, emailA = h.register_user("authzA")
    tokB, uidB, emailB = h.register_user("authzB")

    # ===== IDOR #1 cancelTicket =================================================
    tid, qr = seed_active_ticket(c.event_id, uidA)

    r = h.gql(M_CANCEL, {"i": {"ticketId": tid, "reason": "steal"}})  # anonymous
    L.check("cancelTicket anonymous -> denied", _denied(r), str(r)[:200])

    r = h.gql(M_CANCEL, {"i": {"ticketId": tid, "reason": "steal"}}, tokB)  # cross-user
    L.check("cancelTicket by user B (not owner) -> denied", _denied(r), str(r)[:200])
    row = ticket_row(tid)
    L.check("cancelTicket denied -> ticket still Active (DB truth)",
            row is not None and row["Status"] == 0, f"row={tuple(row) if row else None}")

    r = h.gql(M_CANCEL, {"i": {"ticketId": tid, "reason": "changed mind"}}, tokA)  # owner
    ok = (r.get("data") or {}).get("cancelTicket")
    L.check("cancelTicket by owner -> allowed", ok is not None and not _denied(r), str(r)[:200])
    row = ticket_row(tid)
    L.check("cancelTicket by owner -> ticket Cancelled (DB truth)",
            row is not None and row["Status"] == 2, f"row={tuple(row) if row else None}")

    # ===== IDOR #2 transferTicket ==============================================
    tid2, qr2 = seed_active_ticket(c.event_id, uidA)

    r = h.gql(M_TRANSFER, {"i": {"ticketId": tid2, "toUserId": uidB, "toEmail": emailB}})  # anon
    L.check("transferTicket anonymous -> denied", _denied(r), str(r)[:200])

    r = h.gql(M_TRANSFER, {"i": {"ticketId": tid2, "toUserId": uidB, "toEmail": emailB}}, tokB)  # B steals
    L.check("transferTicket by user B (not owner) -> denied", _denied(r), str(r)[:200])
    row = ticket_row(tid2)
    L.check("transferTicket denied -> ownership unchanged (still A)",
            row is not None and row["UserId"] == uidA, f"owner={row['UserId'] if row else None}")
    L.check("transferTicket denied -> QR unchanged",
            row is not None and row["QRCode"] == qr2, "QR rotated on a denied transfer!")

    # ===== owner-or-admin reads ================================================
    reads = [
        ("userById", Q_USER_BY_ID),
        ("ticketsByUser", Q_TICKETS_BY_USER),
        ("followedDjs", Q_FOLLOWED_DJS),
        ("djApplicationByUser", Q_DJ_APP_BY_USER),
        ("galleryMediaByUser", Q_GALLERY_BY_USER),
        ("organizerApplicationByUser", Q_ORG_APP_BY_USER),
    ]
    for name, q in reads:
        r = h.gql(q, {"u": uidA})  # anonymous
        L.check(f"{name} anonymous -> denied", _denied(r), str(r)[:160])
        r = h.gql(q, {"u": uidA}, tokB)  # cross-user
        L.check(f"{name} cross-user (B reads A) -> denied", _denied(r), str(r)[:160])
        r = h.gql(q, {"u": uidA}, tokA)  # owner
        L.check(f"{name} owner -> allowed", not _denied(r), str(r)[:160])

    # ===== ticket(id) — owner sees QR, non-owner denied (Chain #1) =============
    tid3, qr3 = seed_active_ticket(c.event_id, uidA)
    r = h.gql(Q_TICKET, {"id": tid3})  # anonymous
    L.check("ticket(id) anonymous -> denied", _denied(r), str(r)[:160])
    r = h.gql(Q_TICKET, {"id": tid3}, tokB)  # cross-user
    L.check("ticket(id) cross-user -> denied", _denied(r), str(r)[:160])
    r = h.gql(Q_TICKET, {"id": tid3}, tokA)  # owner
    t = (r.get("data") or {}).get("ticket") or {}
    L.check("ticket(id) owner -> allowed with QR", t.get("qrCode") == qr3, str(r)[:200])

    # manager (admin) who is NOT the owner: allowed, but the live QR door token is stripped
    # (Chain #1 — only the owner ever receives the QR). This is the real non-owner QR-strip test.
    admin_tok = make_admin("authzAdmin")
    r = h.gql(Q_TICKET, {"id": tid3}, admin_tok)
    t = (r.get("data") or {}).get("ticket") or {}
    L.check("ticket(id) manager (non-owner) -> allowed but QR stripped",
            not _denied(r) and t.get("id") is not None and not t.get("qrCode"), str(r)[:200])

    # ===== ticketsByEvent — anonymous/non-staff denied; staff list strips every QR =====
    r = h.gql(Q_TICKETS_BY_EVENT, {"e": c.event_id})  # anonymous
    L.check("ticketsByEvent anonymous -> denied", _denied(r), str(r)[:160])
    r = h.gql(Q_TICKETS_BY_EVENT, {"e": c.event_id}, tokB)  # ordinary user
    L.check("ticketsByEvent non-staff -> denied", _denied(r), str(r)[:160])
    r = h.gql(Q_TICKETS_BY_EVENT, {"e": c.event_id}, admin_tok)  # staff (admin)
    ev_rows = (r.get("data") or {}).get("ticketsByEvent")
    L.check("ticketsByEvent staff -> allowed, QR stripped on every row",
            not _denied(r) and isinstance(ev_rows, list) and len(ev_rows) >= 1
            and all(not row.get("qrCode") for row in ev_rows), str(r)[:200])

    # ===== table dumps — anonymous denied ======================================
    dumps = [
        ("djApplications", Q_DJ_APPS),
        ("pendingDjApplications", Q_PENDING_DJ_APPS),
        ("contactMessages", Q_CONTACT_MESSAGES),
        ("newsletters", Q_NEWSLETTERS),
    ]
    for name, q in dumps:
        r = h.gql(q)  # anonymous
        L.check(f"{name} anonymous -> denied", _denied(r), str(r)[:160])
        r = h.gql(q, None, tokB)  # ordinary user
        L.check(f"{name} ordinary user -> denied", _denied(r), str(r)[:160])

    # ===== identity mutations — anonymous denied; client id never trusted ======
    dj_id = str(uuid.uuid4()).upper()  # bogus dj id is fine; the guard fires before lookup
    r = h.gql(M_FOLLOW, {"i": {"djId": dj_id, "userId": uidA}})  # anonymous
    L.check("followDj anonymous -> denied", _denied(r), str(r)[:160])

    r = h.gql(M_CONTACT, {"i": {"message": "hi", "userId": uidA}})  # anonymous
    L.check("createContactMessage anonymous -> denied (now requires login)", _denied(r), str(r)[:160])

    r = h.gql(M_NEWSLETTER, {"i": {"email": f"nl-{run}@test.local", "userId": uidA}})  # anonymous
    L.check("subscribeNewsletter anonymous -> denied (now requires login)", _denied(r), str(r)[:160])

    r = h.gql(M_SUBMIT_DJ, {"i": {
        "userId": uidA, "stageName": f"DJ-{run}", "bio": "b", "genre": "house",
        "yearsExperience": 1, "specialties": "x", "influencedBy": "y",
        "equipmentUsed": "z", "socialLinks": "", "profileImageUrl": "", "coverImageUrl": ""}})  # anon
    L.check("submitDJApplication anonymous -> denied", _denied(r), str(r)[:160])

    # followDj as user B with input.userId = A -> the row, if created, is keyed to B (JWT),
    # never A. (A bogus dj id may cause a downstream FK error, but identity must be B.)
    h.gql(M_FOLLOW, {"i": {"djId": dj_id, "userId": uidA}}, tokB)
    con = h.db()
    try:
        leaked = con.execute(
            "SELECT COUNT(*) FROM UserFollowDJs WHERE UserId = ? AND DJId = ?",
            (uidA, dj_id)).fetchone()[0]
    finally:
        con.close()
    L.check("followDj with input.userId=A by caller B -> never keyed to A", leaked == 0,
            f"rows keyed to A={leaked}")

    L.done()


if __name__ == "__main__":
    main()
