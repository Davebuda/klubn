"""E2E — P0-WS2 audit trail (Phase 2: Tier-1 privileged ops write attributable rows).

Drives the LIVE GraphQL endpoint and asserts the audit invariant for privileged actions, then
checks DB TRUTH directly in the AuditLogs table:

  role_change_writes_attributable_row
    admin calls updateUserRole(target, 1) -> exactly one AuditLogs row:
      UserId == admin id (the actor, NOT the target), EntityName == 'ApplicationUser',
      EntityId == target, Changes JSON carries the new role.

  ticket_transfer_writes_attributable_row
    admin (manager) transfers an Active ticket -> an AuditLogs row:
      UserId == admin, EntityName == 'Ticket', EntityId == ticketId, Changes has from/to.

  audit_log_query_is_admin_gated
    anonymous auditLogs query -> denied; non-admin user -> denied; admin -> returns rows.

The audit ACTOR is always the JWT-derived caller. To get an admin token the harness only mints
role-0 users, so we register a user, escalate it via a direct DB UPDATE on ApplicationUsers.Role
(role 2 == Admin, per AuthService.MapRole), then LOG IN AGAIN so the fresh JWT carries the Admin
role claim (the claim is baked at login from the DB role).

Run (needs a FRESH SQLite DB + the backend running against it — see scripts/e2e/README.md):

    # 1. start the backend against the disposable e2e DB (Development, Sandbox provider):
    #    ConnectionStrings__DefaultConnection="Data Source=DJDIP_e2e.db" \
    #    ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5102 \
    #    Sandbox__WebhookSecret=sandbox-webhook-secret \
    #    dotnet run --project DJDiP.csproj
    # 2. then, from scripts/e2e/:
    #    python audit_trail.py
"""
import uuid

import _harness as h

# The fixed password register_user() uses — needed to re-login after escalation.
_TEST_PASSWORD = "E2e!TestPass123"
ROLE_ADMIN = 2  # AuthService.MapRole: 2 -> "Admin"


def _denied(resp) -> bool:
    errs = resp.get("errors") or []
    if not errs:
        return False
    blob = " ".join((e.get("message") or "") for e in errs).lower()
    return "access denied" in blob or "authentication required" in blob


def _set_role(user_id: str, role: int) -> None:
    """Direct DB escalation (the harness seeds via direct SQLite inserts; same sanctioned path)."""
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


def make_admin(prefix: str):
    """Register a user, escalate to Admin in the DB, re-login for an Admin-claim token.
    Returns (admin_token, admin_user_id, email)."""
    _, uid, email = h.register_user(prefix)
    _set_role(uid, ROLE_ADMIN)
    return _login(email), uid, email


def seed_active_ticket(event_id: str, user_id: str):
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


def audit_rows(*, entity_name=None, entity_id=None, user_id=None):
    """Read AuditLogs straight from the DB (DB truth)."""
    sql = "SELECT Id,Action,EntityName,EntityId,UserId,Changes FROM AuditLogs WHERE 1=1"
    args = []
    if entity_name is not None:
        sql += " AND EntityName = ?"; args.append(entity_name)
    if entity_id is not None:
        # EntityId is stored as the canonical lowercase Guid (ticket.Id.ToString()), while seeded
        # ticket ids are uppercase — compare case-insensitively so DB-truth lookups match.
        sql += " AND EntityId = ? COLLATE NOCASE"; args.append(entity_id)
    if user_id is not None:
        sql += " AND UserId = ?"; args.append(user_id)
    con = h.db()
    try:
        return con.execute(sql, tuple(args)).fetchall()
    finally:
        con.close()


# ---- GraphQL ops ---------------------------------------------------------------

M_UPDATE_ROLE = "mutation($u:String!,$r:Int!){ updateUserRole(userId:$u, role:$r) }"
M_TRANSFER = "mutation($i:TransferTicketInput!){ transferTicket(input:$i){ id userId } }"
Q_AUDIT = ("query($e:String,$id:String,$u:String,$s:Int!,$t:Int!){ "
           "auditLogs(entityName:$e, entityId:$id, userId:$u, skip:$s, take:$t)"
           "{ id action entityName entityId userId changes } }")


def main():
    c = h.cfg()
    L = h.Ledger("audit_trail")

    admin_tok, admin_uid, _ = make_admin("auditAdmin")

    # ===== role_change_writes_attributable_row =================================
    _, target_uid, _ = h.register_user("auditTarget")

    r = h.gql(M_UPDATE_ROLE, {"u": target_uid, "r": 1}, admin_tok)
    L.check("updateUserRole by admin -> allowed",
            (r.get("data") or {}).get("updateUserRole") is True and not _denied(r), str(r)[:200])

    rows = audit_rows(entity_name="ApplicationUser", entity_id=target_uid)
    role_rows = [row for row in rows if row["Action"] == "RoleChange"]
    L.check("RoleChange -> exactly one audit row (DB truth)", len(role_rows) == 1,
            f"rows={len(role_rows)}")
    if role_rows:
        row = role_rows[0]
        L.check("RoleChange row actor == admin (not target)",
                row["UserId"] == admin_uid and row["UserId"] != target_uid,
                f"UserId={row['UserId']} admin={admin_uid} target={target_uid}")
        L.check("RoleChange row EntityName == ApplicationUser",
                row["EntityName"] == "ApplicationUser", row["EntityName"])
        L.check("RoleChange row EntityId == target", row["EntityId"] == target_uid,
                f"EntityId={row['EntityId']}")
        L.check("RoleChange Changes carries the new role",
                row["Changes"] is not None and '"newRole":1' in row["Changes"].replace(" ", ""),
                f"Changes={row['Changes']}")

    # ===== ticket_transfer_writes_attributable_row =============================
    _, recipient_uid, recipient_email = h.register_user("auditRecipient")
    # Ticket owned by an ordinary user; the admin acts as a manager to transfer it.
    _, owner_uid, _ = h.register_user("auditOwner")
    tid, _ = seed_active_ticket(c.event_id, owner_uid)

    r = h.gql(M_TRANSFER,
              {"i": {"ticketId": tid, "toUserId": recipient_uid, "toEmail": recipient_email}},
              admin_tok)
    L.check("transferTicket by admin (manager) -> allowed",
            (r.get("data") or {}).get("transferTicket") is not None and not _denied(r), str(r)[:200])

    trows = audit_rows(entity_name="Ticket", entity_id=tid)
    xfer_rows = [row for row in trows if row["Action"] == "TicketTransfer"]
    L.check("TicketTransfer -> exactly one audit row (DB truth)", len(xfer_rows) == 1,
            f"rows={len(xfer_rows)}")
    if xfer_rows:
        row = xfer_rows[0]
        L.check("TicketTransfer row actor == admin", row["UserId"] == admin_uid,
                f"UserId={row['UserId']}")
        L.check("TicketTransfer row EntityId == ticketId",
                (row["EntityId"] or "").lower() == tid.lower(),
                f"EntityId={row['EntityId']}")
        compact = (row["Changes"] or "").replace(" ", "")
        L.check("TicketTransfer Changes carries from/to",
                owner_uid in compact and recipient_uid in compact,
                f"Changes={row['Changes']}")

    # ===== audit_log_query_is_admin_gated ======================================
    qvars = {"e": None, "id": None, "u": None, "s": 0, "t": 50}

    r = h.gql(Q_AUDIT, qvars)  # anonymous
    L.check("auditLogs anonymous -> denied", _denied(r), str(r)[:160])

    _, _, nonadmin_email = h.register_user("auditNonAdmin")
    nonadmin_tok = _login(nonadmin_email)
    r = h.gql(Q_AUDIT, qvars, nonadmin_tok)  # ordinary user
    L.check("auditLogs non-admin user -> denied", _denied(r), str(r)[:160])

    r = h.gql(Q_AUDIT, qvars, admin_tok)  # admin
    data = (r.get("data") or {}).get("auditLogs")
    L.check("auditLogs admin -> allowed, returns rows",
            not _denied(r) and isinstance(data, list) and len(data) >= 1, str(r)[:200])

    L.done()


if __name__ == "__main__":
    main()
