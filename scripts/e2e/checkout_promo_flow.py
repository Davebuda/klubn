"""E2E 2/5 — PROMO reserve -> consume -> issue, idempotency, redemption caps (design §3.1/§6).

Drives the full promo lifecycle against the live backend and asserts DB truth at each step:
  create (REST, with promo)  -> PromotionCode.UsageCount=1, PromoRedemption(Reserved),
                                 Order.DiscountMinor correct, OrderItem.DiscountMinor sums
                                 exactly to it, Payment.Amount = discounted total
  sandbox capture (signed webhook) -> redemption Consumed, tickets issued w/ QR,
                                 TicketType Sold += / Held -= , Order Fulfilled
  REPLAY same capture        -> idempotent (ticket count + counters unchanged)
  MaxRedemptions=1, 2nd user -> create rejected "no longer available"
  per-user cap (cap=1), same user 2nd order -> rejected
"""
import _harness as h


def main():
    c = h.cfg()
    L = h.Ledger("checkout_promo_flow")
    run = h.uniq()

    # ---- seed: a GA tier (cap 20) + a 20% promo with global cap 1, per-user cap 1 -----
    ga = h.seed_ticket_type(event_id=c.event_id, name=f"PF-GA-{run}", price_minor=25000,
                            capacity=20, max_per_order=10)
    code = f"SAVE20-{run}".upper()
    promo_id = h.seed_promo(code=code, kind=h.PROMO_PERCENT, discount_pct="20",
                            event_id=c.event_id, max_redemptions=1, max_per_user=1)

    tok, uid, email = h.register_user("promo")

    # ---- 1. create with promo (REST) ----------------------------------------
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email, "promoCode": code,
                       "lines": [{"ticketTypeId": ga, "quantity": 2}]}, tok)
    L.check("create+promo -> 200", st == 200, f"status={st} {resp}")
    if st != 200:
        L.done()
    ref = resp["order"]["reference"]
    # 2x25000 = 50000 gross; 20% off = 10000 discount; payable 40000.
    L.check("create payload total = 40000 øre", resp["order"]["totalMinor"] == 40000,
            str(resp["order"]["totalMinor"]))

    # ---- 1b. DB after create: usage reserved, discount allocated ------------
    con = h.db()
    usage = con.execute("SELECT UsageCount FROM PromotionCodes WHERE Id = ?", (promo_id,)).fetchone()[0]
    L.check("PromotionCode.UsageCount = 1 (reserved at create)", usage == 1, str(usage))

    red = con.execute("SELECT Status, UserId FROM PromoRedemptions WHERE PromoCodeId = ? AND UserId = ?",
                      (promo_id, uid)).fetchone()
    L.check("PromoRedemption row = Reserved(0)", red and red["Status"] == h.RED_RESERVED, str(dict(red) if red else None))

    order = con.execute("SELECT * FROM Orders WHERE Reference = ?", (ref,)).fetchone()
    L.check("Order.DiscountMinor = 10000", order["DiscountMinor"] == 10000, str(order["DiscountMinor"]))
    L.check("Order.Status = Pending", order["Status"] == h.ORD_PENDING, str(order["Status"]))

    item_discounts = con.execute(
        "SELECT DiscountMinor FROM OrderItems WHERE OrderId = ?", (order["Id"],)).fetchall()
    item_sum = sum(r["DiscountMinor"] for r in item_discounts)
    L.check("sum(OrderItem.DiscountMinor) == Order.DiscountMinor (exact allocation)",
            item_sum == order["DiscountMinor"], f"items={item_sum} order={order['DiscountMinor']}")

    pay = con.execute("SELECT * FROM Payments WHERE ProviderReference = ?", (ref,)).fetchone()
    # Payment.Amount is decimal NOK (discounted total/100) = 400.0
    L.check("Payment.Amount = 400.0 NOK (discounted)", float(pay["Amount"]) == 400.0, str(pay["Amount"]))
    L.check("Payment.Status = Created", pay["Status"] == h.PAY_CREATED, str(pay["Status"]))
    sold0, held0, _ = h.tt_counters(ga)
    L.check("after create: GA Held = 2, Sold = 0", held0 == 2 and sold0 == 0, f"sold={sold0} held={held0}")
    con.close()

    # ---- 2. sandbox capture via SIGNED webhook (the production path) ---------
    body = {"orderRef": ref, "pspRef": f"psp-{ref}", "type": "Captured",
            "amountMinor": 40000, "currency": "NOK"}
    status = h.webhook("sandbox", body)
    L.check("signed Captured webhook -> 200", status == 200, f"status={status}")

    con = h.db()
    red = con.execute("SELECT Status FROM PromoRedemptions WHERE PromoCodeId = ? AND UserId = ?",
                      (promo_id, uid)).fetchone()
    L.check("redemption -> Consumed(1)", red and red["Status"] == h.RED_CONSUMED, str(dict(red) if red else None))
    con.close()

    tickets = h.tickets_for_ref(ref)
    L.check("2 tickets issued", len(tickets) == 2, str(len(tickets)))
    L.check("every ticket has a QR token", all(t["QRCode"] for t in tickets),
            str([bool(t["QRCode"]) for t in tickets]))

    order = h.order_by_ref(ref)
    L.check("Order -> Fulfilled(5)", order["Status"] == h.ORD_FULFILLED, str(order["Status"]))
    sold1, held1, _ = h.tt_counters(ga)
    L.check("counters: GA Sold = 2, Held = 0", sold1 == 2 and held1 == 0, f"sold={sold1} held={held1}")

    # ---- 3. REPLAY the same capture -> idempotent ---------------------------
    status = h.webhook("sandbox", body)
    L.check("replay same webhook -> 200 (idempotent)", status == 200, f"status={status}")
    tickets2 = h.tickets_for_ref(ref)
    L.check("ticket count unchanged after replay (still 2)", len(tickets2) == 2, str(len(tickets2)))
    sold2, held2, _ = h.tt_counters(ga)
    L.check("counters unchanged after replay (Sold 2 / Held 0)", sold2 == 2 and held2 == 0,
            f"sold={sold2} held={held2}")

    # ---- 4. MaxRedemptions=1: a SECOND user can't create with the code ------
    tok2, uid2, email2 = h.register_user("promo2")
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email2, "promoCode": code,
                       "lines": [{"ticketTypeId": ga, "quantity": 1}]}, tok2)
    L.check("2nd user + exhausted code -> rejected (409)", st == 409, f"status={st} {resp}")
    msg = (resp or {}).get("detail", "") if isinstance(resp, dict) else str(resp)
    L.check("rejection reason mentions usage/availability",
            any(w in msg.lower() for w in ("no longer available", "usage limit", "reached")), msg)
    # DB-truth: usage count not bumped past 1 by the rejected attempt.
    con = h.db()
    usage = con.execute("SELECT UsageCount FROM PromotionCodes WHERE Id = ?", (promo_id,)).fetchone()[0]
    L.check("UsageCount still 1 after rejected 2nd-user create", usage == 1, str(usage))
    con.close()

    # ---- 5. per-user cap: a code with per_user=1 (uncapped globally), same user 2nd order
    code2 = f"ONEUSER-{run}".upper()
    promo2_id = h.seed_promo(code=code2, kind=h.PROMO_PERCENT, discount_pct="10",
                             event_id=c.event_id, max_per_user=1)
    tok3, uid3, email3 = h.register_user("peruser")
    # first order with code2 -> ok
    st, r1 = h.rest("POST", "/api/checkout/create",
                    {"eventId": c.event_id, "customerEmail": email3, "promoCode": code2,
                     "lines": [{"ticketTypeId": ga, "quantity": 1}]}, tok3)
    L.check("per-user code: 1st order ok (200)", st == 200, f"status={st} {r1}")
    # second order, SAME user -> rejected by per-user cap
    st, r2 = h.rest("POST", "/api/checkout/create",
                    {"eventId": c.event_id, "customerEmail": email3, "promoCode": code2,
                     "lines": [{"ticketTypeId": ga, "quantity": 1}]}, tok3)
    L.check("per-user code: same user 2nd order -> rejected (409)", st == 409, f"status={st} {r2}")
    msg2 = (r2 or {}).get("detail", "") if isinstance(r2, dict) else str(r2)
    L.check("per-user rejection reason mentions 'already used'",
            "already used" in msg2.lower(), msg2)

    L.done()


if __name__ == "__main__":
    main()
