"""E2E 6/6 — HIDDEN-TIER REVEAL via ticketTypes(unlockCode) (design §3.2).

Proves the public ticketTypes query gates a hidden tier's existence and reveals it ONLY for a
valid UnlocksHiddenTypes promo — then proves the revealed tier flows all the way through
quote -> create -> signed-webhook capture -> issued ticket (it is genuinely purchasable, not
just visible).

  ticketTypes(no code)        -> hidden tier ABSENT (existence gated)
  ticketTypes(bogus code)     -> hidden tier ABSENT (anti-oracle: same as no code, no error)
  ticketTypes(non-unlock code)-> hidden tier ABSENT (a real but non-unlock code reveals nothing)
  ticketTypes(valid code)     -> hidden tier PRESENT + isUnlocked=true; public tiers isUnlocked=false
  quote(valid code, hidden)   -> ok=true, priced
  create(valid code, hidden)  -> order created, hold placed
  signed Captured webhook     -> exactly one ticket issued, tier Sold+=, Order Fulfilled

DB-truth guard: the three "ABSENT" reads write ZERO Orders (a reveal is a pure read).
"""
import _harness as h

TICKET_TYPES_Q = """
  query($eventId: UUID!, $unlockCode: String) {
    ticketTypes(eventId: $eventId, unlockCode: $unlockCode) {
      id name status isUnlocked
    }
  }"""


def _ids(resp):
    """Return {id: isUnlocked} from a ticketTypes response."""
    tiers = ((resp.get("data") or {}).get("ticketTypes")) or []
    return {t["id"].upper(): bool(t["isUnlocked"]) for t in tiers}


def main():
    c = h.cfg()
    L = h.Ledger("checkout_hidden_reveal")
    run = h.uniq()

    # ---- seed: a public GA tier + a HIDDEN VIP tier; one unlock promo scoped to the hidden
    #            tier, plus a plain (non-unlock) discount code to prove non-unlock reveals nothing.
    ga = h.seed_ticket_type(event_id=c.event_id, name=f"HR-GA-{run}", price_minor=25000,
                            capacity=50, max_per_order=10, sort_order=0)
    hidden = h.seed_ticket_type(event_id=c.event_id, name=f"HR-VIP-{run}", price_minor=60000,
                                capacity=10, max_per_order=4, is_hidden=True, sort_order=1)

    unlock = f"REVEAL{run}".upper()
    h.seed_promo(code=unlock, kind=h.PROMO_PERCENT, discount_pct="0", event_id=c.event_id,
                 unlocks_hidden=True, ticket_type_ids=[hidden])
    plain = f"PLAIN{run}".upper()
    h.seed_promo(code=plain, kind=h.PROMO_PERCENT, discount_pct="10", event_id=c.event_id,
                 unlocks_hidden=False, ticket_type_ids=[ga])
    bogus = f"NOPE{run}".upper()

    # Snapshot Orders BEFORE the read-only reveals (DB-truth: a reveal must not write).
    con = h.db()
    orders_before = con.execute("SELECT COUNT(*) FROM Orders").fetchone()[0]
    con.close()

    # ---- 1. no code -> hidden tier ABSENT -----------------------------------
    seen = _ids(h.gql(TICKET_TYPES_Q, {"eventId": c.event_id, "unlockCode": None}))
    L.check("no code: public GA present", ga in seen, str(list(seen.keys())))
    L.check("no code: hidden tier ABSENT (existence gated)", hidden not in seen,
            f"hidden={hidden} seen={list(seen.keys())}")

    # ---- 2. bogus code -> hidden tier ABSENT, no error (anti-oracle) ---------
    r = h.gql(TICKET_TYPES_Q, {"eventId": c.event_id, "unlockCode": bogus})
    L.check("bogus code: no GraphQL error surfaced", not r.get("errors"), str(r.get("errors")))
    seen = _ids(r)
    L.check("bogus code: hidden tier still ABSENT", hidden not in seen, str(list(seen.keys())))

    # ---- 3. real-but-non-unlock code -> hidden tier ABSENT -------------------
    seen = _ids(h.gql(TICKET_TYPES_Q, {"eventId": c.event_id, "unlockCode": plain}))
    L.check("non-unlock code: hidden tier ABSENT", hidden not in seen, str(list(seen.keys())))

    # ---- 4. valid unlock code -> hidden tier PRESENT + isUnlocked=true -------
    seen = _ids(h.gql(TICKET_TYPES_Q, {"eventId": c.event_id, "unlockCode": unlock}))
    L.check("unlock code: hidden tier PRESENT", hidden in seen, str(list(seen.keys())))
    L.check("unlock code: revealed tier isUnlocked=true", seen.get(hidden) is True, str(seen))
    L.check("unlock code: public GA isUnlocked=false (not marked)", seen.get(ga) is False, str(seen))

    # ---- 5. DB-truth: the reveals wrote NOTHING -----------------------------
    con = h.db()
    orders_after = con.execute("SELECT COUNT(*) FROM Orders").fetchone()[0]
    con.close()
    L.check("reveal reads created ZERO Orders", orders_after == orders_before,
            f"before={orders_before} after={orders_after}")

    # ---- 6. the revealed tier is genuinely purchasable: quote -> create -> capture ----
    # quote with the unlock code (required to clear the hidden-line gate at quote/create).
    r = h.gql("""query($i: QuoteTicketOrderInput!){ quoteTicketOrder(input:$i){
                   ok totalMinor lines { ticketTypeId } } }""",
              {"i": {"eventId": c.event_id, "promoCode": unlock,
                     "lines": [{"ticketTypeId": hidden, "quantity": 1}]}})
    q = (r.get("data") or {}).get("quoteTicketOrder") or {}
    L.check("quote(unlock, hidden) -> ok=true", q.get("ok") is True, str(r.get("errors") or q))
    L.check("quote total = 60000 øre (0% promo, undiscounted)", q.get("totalMinor") == 60000,
            str(q.get("totalMinor")))

    tok, uid, email = h.register_user("reveal")
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email, "promoCode": unlock,
                       "lines": [{"ticketTypeId": hidden, "quantity": 1}]}, tok)
    L.check("create(unlock, hidden) -> 200", st == 200, f"status={st} {resp}")
    if st != 200:
        L.done()
    ref = resp["order"]["reference"]
    L.check("create payload total = 60000 øre", resp["order"]["totalMinor"] == 60000,
            str(resp["order"]["totalMinor"]))

    sold0, held0, _ = h.tt_counters(hidden)
    L.check("after create: hidden Held = 1, Sold = 0", held0 == 1 and sold0 == 0,
            f"sold={sold0} held={held0}")

    # signed Captured webhook (the production capture path) -> issue exactly one ticket.
    body = {"orderRef": ref, "pspRef": f"psp-{ref}", "type": "Captured",
            "amountMinor": 60000, "currency": "NOK"}
    L.check("signed Captured webhook -> 200", h.webhook("sandbox", body) == 200)

    tickets = h.tickets_for_ref(ref)
    L.check("exactly 1 ticket issued for the revealed tier", len(tickets) == 1, str(len(tickets)))
    L.check("issued ticket has a QR token", bool(tickets and tickets[0]["QRCode"]),
            str([bool(t["QRCode"]) for t in tickets]))
    order = h.order_by_ref(ref)
    L.check("Order -> Fulfilled(5)", order["Status"] == h.ORD_FULFILLED, str(order["Status"]))
    sold1, held1, _ = h.tt_counters(hidden)
    L.check("counters: hidden Sold = 1, Held = 0", sold1 == 1 and held1 == 0,
            f"sold={sold1} held={held1}")

    L.done()


if __name__ == "__main__":
    main()
