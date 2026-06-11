"""E2E 5/5 — HOSTILE inputs / abuse paths (design §3.2/§4.3/§8 + identity rules).

Every case asserts the FAILURE is clean AND leaves no partial state behind:
  oversell create (qty > available)            -> error + DB unchanged (no Order/holds)
  expired promo at create                      -> hard error (create never drops a discount)
  hidden tier in create WITHOUT unlock         -> SAME message as an unknown tier (no leak)
  create with unknown provider name            -> error BEFORE any Order row exists
  quote x5 never creates rows                  -> Orders/PromoRedemptions counts unchanged
  wrong-owner retry (user B retries user A's)  -> rejected, no new attempt
"""
import _harness as h


def order_count():
    con = h.db()
    try:
        return con.execute("SELECT COUNT(*) FROM Orders").fetchone()[0]
    finally:
        con.close()


def redemption_count():
    con = h.db()
    try:
        return con.execute("SELECT COUNT(*) FROM PromoRedemptions").fetchone()[0]
    finally:
        con.close()


def main():
    c = h.cfg()
    L = h.Ledger("checkout_hostile")
    run = h.uniq()

    # small-capacity GA (cap 3) for oversell; a hidden tier; an expired promo.
    ga = h.seed_ticket_type(event_id=c.event_id, name=f"HS-GA-{run}", price_minor=25000,
                            capacity=3, max_per_order=100)  # high maxPerOrder so availability is the gate
    hidden = h.seed_ticket_type(event_id=c.event_id, name=f"HS-HID-{run}", price_minor=30000,
                                capacity=10, max_per_order=10, is_hidden=True)
    expired_code = f"EXPIRED-{run}".upper()
    h.seed_promo(code=expired_code, kind=h.PROMO_PERCENT, discount_pct="10", event_id=c.event_id,
                 valid_until="2000-01-01 00:00:00")  # already expired

    tok, uid, email = h.register_user("hostileA")

    # ---- 1. oversell create (qty > available) -------------------------------
    orders0 = order_count()
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email,
                       "lines": [{"ticketTypeId": ga, "quantity": 4}]}, tok)  # 4 > cap 3
    L.check("oversell create -> error (409)", st == 409, f"status={st} {resp}")
    L.check("oversell create made NO new Order", order_count() == orders0, f"before={orders0} after={order_count()}")
    sold, held, cap = h.tt_counters(ga)
    L.check("oversell create left GA inventory untouched (Sold 0 / Held 0)",
            sold == 0 and held == 0, f"sold={sold} held={held}")

    # ---- 2. expired promo at create -> hard error ---------------------------
    orders1 = order_count()
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email, "promoCode": expired_code,
                       "lines": [{"ticketTypeId": ga, "quantity": 1}]}, tok)
    L.check("expired promo create -> hard error (409)", st == 409, f"status={st} {resp}")
    msg = (resp or {}).get("detail", "") if isinstance(resp, dict) else str(resp)
    L.check("expired promo error mentions expiry/validity", "expired" in msg.lower(), msg)
    L.check("expired promo made NO new Order", order_count() == orders1, f"before={orders1} after={order_count()}")

    # ---- 3. hidden tier in create WITHOUT unlock -> unknown-tier message -----
    # Capture the message an UNKNOWN tier produces, then assert the hidden tier matches it.
    bogus = str(__import__("uuid").uuid4()).upper()
    st_u, resp_u = h.rest("POST", "/api/checkout/create",
                          {"eventId": c.event_id, "customerEmail": email,
                           "lines": [{"ticketTypeId": bogus, "quantity": 1}]}, tok)
    unknown_msg = (resp_u or {}).get("detail", "") if isinstance(resp_u, dict) else str(resp_u)

    st_h, resp_h = h.rest("POST", "/api/checkout/create",
                          {"eventId": c.event_id, "customerEmail": email,
                           "lines": [{"ticketTypeId": hidden, "quantity": 1}]}, tok)
    hidden_msg = (resp_h or {}).get("detail", "") if isinstance(resp_h, dict) else str(resp_h)
    L.check("hidden tier no-unlock create -> error", st_h == 409, f"status={st_h} {resp_h}")
    L.check("hidden-tier message IDENTICAL to unknown-tier message (no existence leak)",
            hidden_msg == unknown_msg and "not found" in hidden_msg.lower(),
            f"unknown={unknown_msg!r} hidden={hidden_msg!r}")

    # ---- 4. unknown provider name -> error before any Order exists ----------
    orders2 = order_count()
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email, "provider": f"NoSuchPSP{run}",
                       "lines": [{"ticketTypeId": ga, "quantity": 1}]}, tok)
    L.check("unknown provider create -> error (400 bad input)", st == 400, f"status={st} {resp}")
    msg = (resp or {}).get("detail", "") if isinstance(resp, dict) else str(resp)
    L.check("unknown provider error mentions provider", "provider" in msg.lower(), msg)
    L.check("unknown provider made NO new Order", order_count() == orders2,
            f"before={orders2} after={order_count()}")

    # ---- 5. quote x5 never creates rows -------------------------------------
    o_before, r_before = order_count(), redemption_count()
    for i in range(5):
        h.rest("POST", "/api/checkout/quote",
               {"eventId": c.event_id,
                "lines": [{"ticketTypeId": ga, "quantity": 1}]})
    L.check("5 quotes created ZERO new Orders", order_count() == o_before,
            f"before={o_before} after={order_count()}")
    L.check("5 quotes created ZERO new PromoRedemptions", redemption_count() == r_before,
            f"before={r_before} after={redemption_count()}")

    # ---- 6. wrong-owner retry -----------------------------------------------
    # User A creates a real (capturable) order; user B tries to retry it.
    ga_ok = h.seed_ticket_type(event_id=c.event_id, name=f"HS-OWN-{run}", price_minor=25000,
                               capacity=10, max_per_order=10)
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email,
                       "lines": [{"ticketTypeId": ga_ok, "quantity": 1}]}, tok)
    L.check("owner setup: A create -> 200", st == 200, f"status={st} {resp}")
    a_ref = resp["order"]["reference"]
    # Force the order into a retry-eligible (failed) state so retry isn't blocked by status.
    fail_body = {"orderRef": a_ref, "pspRef": f"psp-fail-{a_ref}", "type": "Failed",
                 "amountMinor": 0, "currency": "NOK"}
    h.webhook("sandbox", fail_body)

    tokB, uidB, emailB = h.register_user("hostileB")
    attempts_before = len(h.payments_by_ref_prefix(a_ref))
    st, resp = h.rest("POST", "/api/checkout/retry", {"reference": a_ref}, tokB)
    L.check("wrong-owner retry -> rejected (409)", st == 409, f"status={st} {resp}")
    msg = (resp or {}).get("detail", "") if isinstance(resp, dict) else str(resp)
    L.check("wrong-owner retry reason mentions ownership",
            "your own order" in msg.lower() or "own order" in msg.lower(), msg)
    L.check("wrong-owner retry created NO new Payment attempt",
            len(h.payments_by_ref_prefix(a_ref)) == attempts_before,
            f"before={attempts_before} after={len(h.payments_by_ref_prefix(a_ref))}")

    L.done()


if __name__ == "__main__":
    main()
