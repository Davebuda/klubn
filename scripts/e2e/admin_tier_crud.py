"""E2E — Admin ticket-type (tier) CRUD: authz boundaries, Draft-footgun, lifecycle semantics,
validation guards, purchase leg, and delete guards.

Proves the "empty/Draft tier" incident class is caught automatically:
  - A tier created without an explicit status defaults to Draft and is invisible to the public.
  - Activating it (ON_SALE) makes it visible immediately, with correct available count.
  - The frontend-contracts Paused/Closed semantics: still listed, but quote refuses purchase.
  - Validation guards reject bad capacity/per-order values before any row is written.
  - A sold tier cannot be deleted; an unsold closed tier can.

Run (needs a FRESH SQLite DB + backend on Sandbox provider — see scripts/e2e/README.md):

    python admin_tier_crud.py

GraphQL conventions:
  - Guid args are UUID! (never ID!)
  - Status inputs are enum tokens (ON_SALE, PAUSED, CLOSED, DRAFT)
  - Status in DTO responses is a string ("OnSale", "Paused", "Closed", "Draft")
  - Money is integer øre (minor units)
  - ticketTypes(eventId)          — public; returns only OnSale, non-hidden tiers
  - ticketTypesByEvent(eventId)   — admin (CoAdmin+); returns all tiers
"""
import json
import uuid

import _harness as h

# ---- GraphQL fragments ---------------------------------------------------------

# Two DIFFERENT DTOs: public ticketTypes returns TicketTypeAvailabilityDto (has
# available/isUnlocked, NO capacity/sold/held); admin ticketTypesByEvent returns
# TicketTypeDto (has capacity/quantitySold/quantityHeld). Projections must differ
# or the public query is a schema-validation error (data:null) — never share them.
_TT_PUBLIC_FIELDS = "id name status available sortOrder priceMinor"
_TT_ADMIN_FIELDS = "id name status available capacity quantitySold quantityHeld sortOrder priceMinor"

Q_PUBLIC_TIERS = f"""query($e: UUID!) {{
    ticketTypes(eventId: $e) {{ {_TT_PUBLIC_FIELDS} }} }}"""

Q_ADMIN_TIERS = f"""query($e: UUID!) {{
    ticketTypesByEvent(eventId: $e) {{ {_TT_ADMIN_FIELDS} }} }}"""

M_CREATE_TT = """mutation($i: CreateTicketTypeInput!) {
    createTicketType(input: $i) { id name status capacity sortOrder priceMinor minPerOrder maxPerOrder } }"""

M_UPDATE_TT = """mutation($i: UpdateTicketTypeInput!) {
    updateTicketType(input: $i) { id name status capacity quantitySold minPerOrder maxPerOrder } }"""

M_DELETE_TT = """mutation($id: UUID!) {
    deleteTicketType(id: $id) }"""

Q_QUOTE = """query($i: QuoteTicketOrderInput!) {
    quoteTicketOrder(input: $i) { ok reason totalMinor } }"""

# ---- Auth helpers (mirror authz_resolvers.py) ----------------------------------

_TEST_PASSWORD = "E2e!TestPass123"
ROLE_ADMIN = 2  # mirrors AuthService.MapRole: 2 -> "Admin"


def _set_role(user_id: str, role: int) -> None:
    con = h.db()
    try:
        con.execute("UPDATE ApplicationUsers SET Role = ? WHERE Id = ?", (role, user_id))
        con.commit()
    finally:
        con.close()


def _login(email: str) -> str:
    r = h.gql("""mutation($i: LoginInput!) { login(input: $i) { accessToken } }""",
              {"i": {"email": email, "password": _TEST_PASSWORD}})
    tok = ((r.get("data") or {}).get("login") or {}).get("accessToken")
    if not tok:
        raise RuntimeError(f"login failed: {r}")
    return tok


def make_admin(prefix: str) -> str:
    """Register a user, escalate to Admin in the DB, re-login so the JWT carries Admin claim."""
    _, uid, email = h.register_user(prefix)
    _set_role(uid, ROLE_ADMIN)
    return _login(email)


def _denied(resp) -> bool:
    """True when the GraphQL response carries an access-denied / auth-required error.

    Raises AssertionError on a GraphQL validation error (unknown field / wrong type) so a
    mis-typed test query never silently passes as an authz denial."""
    errs = resp.get("errors") or []
    if not errs:
        return False
    blob = " ".join((e.get("message") or "") for e in errs).lower()
    if ("does not exist on the type" in blob or "does not exist on type" in blob
            or "unknown field" in blob or "unknown argument" in blob):
        raise AssertionError(
            "GraphQL validation error in test query (fix the query, not the app): "
            + str([e.get("message") for e in errs]))
    return "access denied" in blob or "authentication required" in blob


def _has_error(resp) -> bool:
    """True when the response has any errors array entry (authz OR validation from the app)."""
    return bool(resp.get("errors"))


# ---- Checkout helpers (from checkout_exactly_once.py pattern) ------------------

def _create_order(event_id: str, tok, email, ticket_type_id: str, qty: int = 1) -> str:
    # event_id must be THIS suite's fresh event — not the harness's seeded one —
    # or checkout 409s with "ticket types were not found for this event".
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": event_id,
                       "customerEmail": email,
                       "lines": [{"ticketTypeId": ticket_type_id, "quantity": qty}]}, tok)
    if st != 200:
        raise RuntimeError(f"checkout/create failed {st}: {resp}")
    return resp["order"]["reference"]


# ---- Helpers to read tier rows from DB -----------------------------------------

def _db_tier(tier_id: str):
    con = h.db()
    try:
        return con.execute(
            "SELECT * FROM TicketTypes WHERE Id = ?", (tier_id,)).fetchone()
    finally:
        con.close()


def _tier_by_id_in_list(tiers: list, tier_id: str) -> dict | None:
    for t in tiers:
        if str(t.get("id", "")).upper() == tier_id.upper():
            return t
    return None


# ---- Main suite ----------------------------------------------------------------

def main():
    c = h.cfg()
    L = h.Ledger("admin_tier_crud")
    run = h.uniq()

    # ===== 1. SEED: admin token + fresh event ===================================
    # Create an admin user via DB escalation (same pattern as authz_resolvers.py).
    admin_tok = make_admin(f"tieradmin-{run}")

    # Create a fresh event so this suite is fully self-contained and isolated from
    # whatever tiers other suites may have added to the seeded "KlubN Opening Night" event.
    # createEvent returns a bare UUID! (no selection set allowed); CreateEventInput
    # requires price + description and has NO isPublished field (schema.hc16:825).
    event_r = h.gql("""mutation($i: CreateEventInput!) {
        createEvent(input: $i) }""",
        {"i": {
            "title": f"TierCrud-{run}",
            "date": "2099-12-31T20:00:00Z",
            "venueId": _get_any_venue_id(),
            "price": 0,
            "description": "E2E tier CRUD test event",
            "imageUrl": "https://example.com/img.jpg",
        }}, admin_tok)
    event_id = (event_r.get("data") or {}).get("createEvent")
    if not event_id:
        L.fatal("seed: createEvent -> returned id", str(event_r)[:300])
    L.check("seed: createEvent returns id", bool(event_id), str(event_id))

    # ===== 2. PUBLIC EMPTY STATE ================================================
    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes")
    L.check("public ticketTypes(eventId) for fresh event -> empty list []",
            isinstance(public_tiers, list) and len(public_tiers) == 0,
            f"got: {public_tiers}")

    # ===== 3. AUTHZ: anonymous + regular user denied on all three mutations ======
    reg_tok, _, _ = h.register_user(f"tieruser-{run}")

    # --- createTicketType -------------------------------------------------------
    create_input = {
        "eventId": event_id, "name": f"GA-{run}", "priceMinor": 25000,
        "capacity": 100, "admitCount": 1, "minPerOrder": 1, "maxPerOrder": 10,
        "sortOrder": 0, "status": "ON_SALE",
    }
    r = h.gql(M_CREATE_TT, {"i": create_input})  # anonymous
    L.check("createTicketType anonymous -> denied", _denied(r), str(r)[:200])

    r = h.gql(M_CREATE_TT, {"i": create_input}, reg_tok)  # regular user
    L.check("createTicketType regular user -> denied", _denied(r), str(r)[:200])

    # --- updateTicketType (need a tier id; use a dummy uuid — guard fires before lookup) ---
    dummy_id = str(uuid.uuid4()).upper()
    update_input = {"id": dummy_id, "status": "ON_SALE"}
    r = h.gql(M_UPDATE_TT, {"i": update_input})  # anonymous
    L.check("updateTicketType anonymous -> denied", _denied(r), str(r)[:200])

    r = h.gql(M_UPDATE_TT, {"i": update_input}, reg_tok)  # regular user
    L.check("updateTicketType regular user -> denied", _denied(r), str(r)[:200])

    # --- deleteTicketType -------------------------------------------------------
    r = h.gql(M_DELETE_TT, {"id": dummy_id})  # anonymous
    L.check("deleteTicketType anonymous -> denied", _denied(r), str(r)[:200])

    r = h.gql(M_DELETE_TT, {"id": dummy_id}, reg_tok)  # regular user
    L.check("deleteTicketType regular user -> denied", _denied(r), str(r)[:200])

    # ===== 4. DRAFT DEFAULT FOOTGUN =============================================
    # Admin creates a tier WITHOUT a status field — must default to Draft.
    r = h.gql(M_CREATE_TT, {"i": {
        "eventId": event_id, "name": f"Draft-{run}", "priceMinor": 20000,
        "capacity": 50, "admitCount": 1, "minPerOrder": 1, "maxPerOrder": 5,
        "sortOrder": 99,
        # NOTE: no "status" field — exercises the Draft-default path
    }}, admin_tok)
    draft_data = (r.get("data") or {}).get("createTicketType")
    L.check("createTicketType without status -> succeeds",
            draft_data is not None and not _denied(r), str(r)[:200])
    draft_status = (draft_data or {}).get("status", "")
    L.check("createTicketType default status == 'Draft' (footgun: invisible to public)",
            draft_status == "Draft", f"status={draft_status!r}")
    draft_id = (draft_data or {}).get("id", "")

    # Public still sees nothing (Draft is excluded from ticketTypes)
    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes", [])
    L.check("public ticketTypes after Draft create -> still []",
            len(public_tiers) == 0, f"got {len(public_tiers)} tiers")

    # Admin CAN see it via ticketTypesByEvent
    r = h.gql(Q_ADMIN_TIERS, {"e": event_id}, admin_tok)
    admin_tiers = (r.get("data") or {}).get("ticketTypesByEvent", [])
    draft_in_admin = _tier_by_id_in_list(admin_tiers, draft_id)
    L.check("admin ticketTypesByEvent includes the Draft tier",
            draft_in_admin is not None, f"ids={[t.get('id') for t in admin_tiers]}")

    # ===== 5. ACTIVATE: Draft -> ON_SALE, public now sees it ====================
    r = h.gql(M_UPDATE_TT, {"i": {"id": draft_id, "status": "ON_SALE"}}, admin_tok)
    updated = (r.get("data") or {}).get("updateTicketType")
    L.check("updateTicketType Draft -> ON_SALE succeeds",
            updated is not None and not _denied(r), str(r)[:200])
    L.check("updated status == 'OnSale'",
            (updated or {}).get("status") == "OnSale",
            f"status={(updated or {}).get('status')!r}")

    # Public sees it now, with available == capacity
    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes", [])
    activated = _tier_by_id_in_list(public_tiers, draft_id)
    L.check("public ticketTypes after activate -> includes the tier",
            activated is not None, f"ids={[t.get('id') for t in public_tiers]}")
    # capacity is NOT on the public DTO (TicketTypeAvailabilityDto) — only available is.
    L.check("activated tier available == capacity (50)",
            activated is not None and activated.get("available") == 50,
            f"available={activated.get('available') if activated else 'N/A'}")
    L.check("activated tier status string == 'OnSale'",
            activated is not None and activated.get("status") == "OnSale",
            f"status={activated.get('status') if activated else 'N/A'!r}")

    # Rename the activated tier so we can refer to it cleanly as GA.
    ga_id = draft_id

    # ===== 6. MULTI-TIER: add VIP, public list returns both ordered by sortOrder =
    r = h.gql(M_CREATE_TT, {"i": {
        "eventId": event_id, "name": f"VIP-{run}", "priceMinor": 50000,
        "capacity": 20, "admitCount": 1, "minPerOrder": 1, "maxPerOrder": 4,
        "sortOrder": 10, "status": "ON_SALE",
    }}, admin_tok)
    vip_data = (r.get("data") or {}).get("createTicketType")
    L.check("admin createTicketType VIP (ON_SALE explicit) -> succeeds",
            vip_data is not None and not _denied(r), str(r)[:200])
    vip_id = (vip_data or {}).get("id", "")

    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes", [])
    L.check("public list contains both tiers after VIP create",
            len(public_tiers) == 2, f"count={len(public_tiers)}")
    # sortOrder: GA=99, VIP=10 -> VIP should come first (lower sortOrder)
    if len(public_tiers) >= 2:
        L.check("tiers ordered by sortOrder (VIP sortOrder=10 before GA sortOrder=99)",
                public_tiers[0].get("id", "").upper() == vip_id.upper(),
                f"first={public_tiers[0].get('id')} expected vip={vip_id}")

    # ===== 7. VALIDATION REJECTIONS ============================================
    # Each must error; none may create or patch a tier.
    base_create = {
        "eventId": event_id, "admitCount": 1, "priceMinor": 10000,
        "minPerOrder": 1, "maxPerOrder": 10, "sortOrder": 0,
    }

    # 7a. capacity: -1
    r = h.gql(M_CREATE_TT, {"i": {**base_create, "name": f"BadCap-{run}", "capacity": -1}},
              admin_tok)
    L.check("create capacity=-1 -> error",
            _has_error(r) and not (r.get("data") or {}).get("createTicketType"),
            str(r)[:200])

    # 7b. minPerOrder: 0
    r = h.gql(M_CREATE_TT, {"i": {**base_create, "name": f"BadMin-{run}",
                                    "capacity": 10, "minPerOrder": 0}}, admin_tok)
    L.check("create minPerOrder=0 -> error",
            _has_error(r) and not (r.get("data") or {}).get("createTicketType"),
            str(r)[:200])

    # 7c. maxPerOrder < minPerOrder
    r = h.gql(M_CREATE_TT, {"i": {**base_create, "name": f"BadMax-{run}",
                                    "capacity": 10, "minPerOrder": 5, "maxPerOrder": 2}},
              admin_tok)
    L.check("create maxPerOrder < minPerOrder -> error",
            _has_error(r) and not (r.get("data") or {}).get("createTicketType"),
            str(r)[:200])

    # 7d. update minPerOrder=0 on existing tier — parity guard
    # The backend DOES validate this on update (lines 3461-3462 of Program.cs):
    #   if (tt.MinPerOrder < 1) throw new GraphQLException("MinPerOrder must be at least 1.")
    # The guard fires AFTER assignment (line 3459), so setting minPerOrder=0 should error.
    r = h.gql(M_UPDATE_TT, {"i": {"id": ga_id, "minPerOrder": 0}}, admin_tok)
    update_min_errored = _has_error(r) and not (r.get("data") or {}).get("updateTicketType")
    if not update_min_errored:
        # FINDING: update minPerOrder=0 unexpectedly succeeded — backend guard may not be in place
        print(f"  FINDING  update minPerOrder=0 succeeded (guard may be missing): {str(r)[:200]}")
    L.check("update minPerOrder=0 -> error (parity guard)",
            update_min_errored, str(r)[:200])

    # ===== 8. PAUSED / CLOSED SEMANTICS ========================================
    # Contract: Paused and Closed tiers remain in the public list (frontend, not API, hides them)
    # but quoteTicketOrder refuses to price them (NotOnSale-class reason).

    # --- 8a. PAUSED -------------------------------------------------------------
    r = h.gql(M_UPDATE_TT, {"i": {"id": vip_id, "status": "PAUSED"}}, admin_tok)
    paused = (r.get("data") or {}).get("updateTicketType")
    L.check("updateTicketType VIP -> PAUSED succeeds",
            paused is not None and not _denied(r), str(r)[:200])
    L.check("paused tier status == 'Paused'",
            (paused or {}).get("status") == "Paused",
            f"status={(paused or {}).get('status')!r}")

    # Public list still contains VIP (resolver only excludes Draft + hidden)
    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes", [])
    vip_in_public = _tier_by_id_in_list(public_tiers, vip_id)
    L.check("Paused VIP still present in public ticketTypes list",
            vip_in_public is not None, f"ids={[t.get('id') for t in public_tiers]}")
    L.check("Paused VIP status string == 'Paused' in public list",
            (vip_in_public or {}).get("status") == "Paused",
            f"status={(vip_in_public or {}).get('status')!r}")

    # quoteTicketOrder for Paused VIP -> ok=false (not on sale)
    r = h.gql(Q_QUOTE, {"i": {
        "eventId": event_id,
        "lines": [{"ticketTypeId": vip_id, "quantity": 1}],
    }})
    quote = (r.get("data") or {}).get("quoteTicketOrder") or {}
    L.check("quote Paused VIP -> ok=false (not on sale)",
            quote.get("ok") is False, f"ok={quote.get('ok')} reason={quote.get('reason')!r}")
    L.check("quote Paused VIP -> has a reason string",
            bool(quote.get("reason")), f"reason={quote.get('reason')!r}")

    # --- 8b. CLOSED -------------------------------------------------------------
    r = h.gql(M_UPDATE_TT, {"i": {"id": vip_id, "status": "CLOSED"}}, admin_tok)
    closed = (r.get("data") or {}).get("updateTicketType")
    L.check("updateTicketType VIP -> CLOSED succeeds",
            closed is not None and not _denied(r), str(r)[:200])
    L.check("closed tier status == 'Closed'",
            (closed or {}).get("status") == "Closed",
            f"status={(closed or {}).get('status')!r}")

    # Public list still contains VIP (Closed is not filtered out — frontend contract)
    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes", [])
    vip_in_public = _tier_by_id_in_list(public_tiers, vip_id)
    L.check("Closed VIP still present in public ticketTypes list",
            vip_in_public is not None, f"ids={[t.get('id') for t in public_tiers]}")
    L.check("Closed VIP status string == 'Closed' in public list",
            (vip_in_public or {}).get("status") == "Closed",
            f"status={(vip_in_public or {}).get('status')!r}")

    # quoteTicketOrder for Closed VIP -> ok=false
    r = h.gql(Q_QUOTE, {"i": {
        "eventId": event_id,
        "lines": [{"ticketTypeId": vip_id, "quantity": 1}],
    }})
    quote = (r.get("data") or {}).get("quoteTicketOrder") or {}
    L.check("quote Closed VIP -> ok=false (not on sale)",
            quote.get("ok") is False, f"ok={quote.get('ok')} reason={quote.get('reason')!r}")
    L.check("quote Closed VIP -> has a reason string",
            bool(quote.get("reason")), f"reason={quote.get('reason')!r}")

    # ===== 9. PURCHASE LEG (Sandbox): full checkout on the OnSale GA tier ========
    buyer_tok, _, buyer_email = h.register_user(f"tierbuyer-{run}")

    # quote first (sanity: GA is OnSale)
    r = h.gql(Q_QUOTE, {"i": {
        "eventId": event_id,
        "lines": [{"ticketTypeId": ga_id, "quantity": 1}],
    }})
    ga_quote = (r.get("data") or {}).get("quoteTicketOrder") or {}
    L.check("quote GA (OnSale) -> ok=true", ga_quote.get("ok") is True,
            f"ok={ga_quote.get('ok')} reason={ga_quote.get('reason')!r}")
    L.check("quote GA total == 20000 øre (price set at create)",
            ga_quote.get("totalMinor") == 20000, f"total={ga_quote.get('totalMinor')}")

    # createTicketOrder
    ref = _create_order(event_id, buyer_tok, buyer_email, ga_id, qty=1)
    L.check("createTicketOrder GA -> reference returned", bool(ref), repr(ref))

    # completeSandboxPayment via webhook (same finalize pattern as checkout_exactly_once.py)
    body = {"orderRef": ref, "pspRef": f"psp-{ref}", "type": "Captured",
            "amountMinor": 20000, "currency": "NOK"}
    wh_status = h.webhook("sandbox", body)
    L.check("sandbox webhook Captured -> 200", wh_status == 200, f"status={wh_status}")

    # DB truth: 1 ticket issued, order Paid, quantitySold incremented
    tickets = h.tickets_for_ref(ref)
    L.check("purchase leg: exactly 1 ticket issued",
            len(tickets) == 1, f"tickets={len(tickets)}")
    order_row = h.order_by_ref(ref)
    # After issuance the orchestrator advances Paid(4) -> Fulfilled(5); with a ticket
    # already asserted issued above, Fulfilled is the correct terminal expectation.
    L.check("purchase leg: order status == Fulfilled (5)",
            order_row is not None and order_row["Status"] == h.ORD_FULFILLED,
            f"status={order_row['Status'] if order_row else None}")

    # quantitySold incremented via admin ticketTypesByEvent
    r = h.gql(Q_ADMIN_TIERS, {"e": event_id}, admin_tok)
    admin_tiers = (r.get("data") or {}).get("ticketTypesByEvent", [])
    ga_row = _tier_by_id_in_list(admin_tiers, ga_id)
    L.check("purchase leg: GA quantitySold == 1 (via admin ticketTypesByEvent)",
            ga_row is not None and ga_row.get("quantitySold") == 1,
            f"quantitySold={ga_row.get('quantitySold') if ga_row else 'N/A'}")

    # ===== 10. DELETE GUARDS ====================================================

    # 10a. Attempt to delete the SOLD GA tier -> must error (has sold tickets)
    r = h.gql(M_DELETE_TT, {"id": ga_id}, admin_tok)
    delete_sold_errored = (_has_error(r)
                           and not (r.get("data") or {}).get("deleteTicketType"))
    errs_blob = " ".join((e.get("message") or "")
                         for e in (r.get("errors") or [])).lower()
    L.check("deleteTicketType SOLD GA -> error",
            delete_sold_errored, str(r)[:200])
    L.check("deleteTicketType SOLD GA error mentions sold tickets",
            "sold" in errs_blob, f"error messages: {errs_blob!r}")

    # GA still exists in admin list (delete was rejected)
    r = h.gql(Q_ADMIN_TIERS, {"e": event_id}, admin_tok)
    admin_tiers = (r.get("data") or {}).get("ticketTypesByEvent", [])
    L.check("SOLD GA still in admin list after rejected delete",
            _tier_by_id_in_list(admin_tiers, ga_id) is not None,
            f"ids={[t.get('id') for t in admin_tiers]}")

    # 10b. Delete the UNSOLD CLOSED VIP tier -> true, disappears from both lists
    r = h.gql(M_DELETE_TT, {"id": vip_id}, admin_tok)
    delete_result = (r.get("data") or {}).get("deleteTicketType")
    L.check("deleteTicketType UNSOLD CLOSED VIP -> true",
            delete_result is True and not _has_error(r), str(r)[:200])

    # Confirm disappears from admin list
    r = h.gql(Q_ADMIN_TIERS, {"e": event_id}, admin_tok)
    admin_tiers = (r.get("data") or {}).get("ticketTypesByEvent", [])
    L.check("deleted VIP absent from admin ticketTypesByEvent",
            _tier_by_id_in_list(admin_tiers, vip_id) is None,
            f"ids={[t.get('id') for t in admin_tiers]}")

    # Confirm disappears from public list
    r = h.gql(Q_PUBLIC_TIERS, {"e": event_id})
    public_tiers = (r.get("data") or {}).get("ticketTypes", [])
    L.check("deleted VIP absent from public ticketTypes",
            _tier_by_id_in_list(public_tiers, vip_id) is None,
            f"ids={[t.get('id') for t in public_tiers]}")

    L.done()


# ---- Venue lookup (needed for createEvent) ------------------------------------

def _get_any_venue_id() -> str:
    """Return the id of any seeded venue from the DB (DbInitializer always seeds one)."""
    con = h.db()
    try:
        row = con.execute("SELECT Id FROM Venues LIMIT 1").fetchone()
        if not row:
            raise RuntimeError("No venue found in DB; cannot create test event. "
                               "Ensure the backend has seeded at least one venue.")
        return row[0]
    finally:
        con.close()


if __name__ == "__main__":
    main()
