"""E2E 4/5 — RETRY / multi-attempt payments + zero-total order (design §3.4/§3.5/§6/§8).

Flow:
  create (Sandbox, with promo)
  -> fire SIGNED Failed webhook  => holds Released, promo UsageCount decremented +
                                    redemption Released, order Cancelled
  -> REST /api/checkout/retry    => new Payment AttemptNo=2, ProviderReference "{ref}-r2",
                                    holds re-Active, promo re-Reserved, order Pending
  -> capture attempt 2 (signed webhook on the -r2 reference) => tickets issued ONCE
  -> retry the now-paid order    => rejected "already paid"

Plus the zero-total leg: a 100%-off promo -> create issues tickets immediately, redirect is
the return page (no provider redirect), Payment is Captured with amount 0.
"""
import _harness as h


def main():
    c = h.cfg()
    L = h.Ledger("checkout_retry")
    run = h.uniq()

    ga = h.seed_ticket_type(event_id=c.event_id, name=f"RT-GA-{run}", price_minor=25000,
                            capacity=30, max_per_order=10)
    code = f"RT10-{run}".upper()
    promo_id = h.seed_promo(code=code, kind=h.PROMO_PERCENT, discount_pct="10",
                            event_id=c.event_id)  # uncapped global, no per-user cap

    tok, uid, email = h.register_user("retry")

    # ---- create (with promo) ------------------------------------------------
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email, "promoCode": code,
                       "lines": [{"ticketTypeId": ga, "quantity": 2}]}, tok)
    L.check("create -> 200", st == 200, f"status={st} {resp}")
    if st != 200:
        L.done()
    ref = resp["order"]["reference"]
    # 2x25000=50000, 10% off => 45000 payable.
    L.check("create total = 45000 øre", resp["order"]["totalMinor"] == 45000, str(resp["order"]["totalMinor"]))

    con = h.db()
    usage_after_create = con.execute("SELECT UsageCount FROM PromotionCodes WHERE Id=?", (promo_id,)).fetchone()[0]
    con.close()
    L.check("promo UsageCount = 1 after create", usage_after_create == 1, str(usage_after_create))
    sold_c, held_c, _ = h.tt_counters(ga)
    L.check("after create: GA Held = 2", held_c == 2, f"held={held_c}")

    # ---- simulate failure: signed Failed webhook ----------------------------
    fail_body = {"orderRef": ref, "pspRef": f"psp-fail-{ref}", "type": "Failed",
                 "amountMinor": 0, "currency": "NOK"}
    s = h.webhook("sandbox", fail_body)
    L.check("signed Failed webhook -> 200", s == 200, f"status={s}")

    order = h.order_by_ref(ref)
    L.check("order -> Cancelled(2)", order["Status"] == h.ORD_CANCELLED, str(order["Status"]))
    holds = h.holds_for_ref(ref)
    L.check("holds Released(2)", all(hh["Status"] == h.HOLD_RELEASED for hh in holds),
            str([hh["Status"] for hh in holds]))
    sold_f, held_f, _ = h.tt_counters(ga)
    L.check("Held released back (this order's 2 returned)", held_f == held_c - 2, f"held {held_c}->{held_f}")
    con = h.db()
    usage_after_fail = con.execute("SELECT UsageCount FROM PromotionCodes WHERE Id=?", (promo_id,)).fetchone()[0]
    red_status = con.execute("SELECT Status FROM PromoRedemptions WHERE OrderId=?", (order["Id"],)).fetchone()[0]
    con.close()
    L.check("promo UsageCount decremented to 0 on failure", usage_after_fail == 0, str(usage_after_fail))
    L.check("redemption -> Released(2) on failure", red_status == h.RED_RELEASED, str(red_status))

    # ---- REST retry ---------------------------------------------------------
    st, rresp = h.rest("POST", "/api/checkout/retry", {"reference": ref}, tok)
    L.check("retry -> 200", st == 200, f"status={st} {rresp}")
    L.check("retry total still 45000 (discount re-applied)", rresp["order"]["totalMinor"] == 45000,
            str(rresp["order"]["totalMinor"]))

    pays = h.payments_by_ref_prefix(ref)
    attempt2 = [p for p in pays if p["AttemptNo"] == 2]
    L.check("new Payment AttemptNo=2 exists", len(attempt2) == 1, str([(p["ProviderReference"], p["AttemptNo"]) for p in pays]))
    if attempt2:
        L.check("attempt2 ProviderReference = '{ref}-r2'", attempt2[0]["ProviderReference"] == f"{ref}-r2",
                attempt2[0]["ProviderReference"])
        L.check("attempt2 Status = Created", attempt2[0]["Status"] == h.PAY_CREATED, str(attempt2[0]["Status"]))

    order = h.order_by_ref(ref)
    L.check("order back to Pending(0) after retry", order["Status"] == h.ORD_PENDING, str(order["Status"]))
    holds = h.holds_for_ref(ref)
    L.check("holds re-Active(0) after retry", all(hh["Status"] == h.HOLD_ACTIVE for hh in holds),
            str([hh["Status"] for hh in holds]))
    con = h.db()
    usage_after_retry = con.execute("SELECT UsageCount FROM PromotionCodes WHERE Id=?", (promo_id,)).fetchone()[0]
    red_status2 = con.execute("SELECT Status FROM PromoRedemptions WHERE OrderId=?", (order["Id"],)).fetchone()[0]
    con.close()
    L.check("promo re-Reserved: UsageCount back to 1", usage_after_retry == 1, str(usage_after_retry))
    L.check("redemption -> Reserved(0) after retry", red_status2 == h.RED_RESERVED, str(red_status2))

    # ---- capture attempt 2 (webhook on the -r2 reference) -------------------
    cap_body = {"orderRef": f"{ref}-r2", "pspRef": f"psp-{ref}-r2", "type": "Captured",
                "amountMinor": 45000, "currency": "NOK"}
    s = h.webhook("sandbox", cap_body)
    L.check("attempt2 capture webhook -> 200", s == 200, f"status={s}")
    tickets = h.tickets_for_ref(ref)
    L.check("tickets issued ONCE (2 total across all attempts)", len(tickets) == 2, str(len(tickets)))
    order = h.order_by_ref(ref)
    L.check("order -> Fulfilled(5)", order["Status"] == h.ORD_FULFILLED, str(order["Status"]))
    con = h.db()
    red_status3 = con.execute("SELECT Status FROM PromoRedemptions WHERE OrderId=?", (order["Id"],)).fetchone()[0]
    con.close()
    L.check("redemption -> Consumed(1) after attempt2 capture", red_status3 == h.RED_CONSUMED, str(red_status3))

    # ---- retry on the now-paid order -> rejected ----------------------------
    st, rresp = h.rest("POST", "/api/checkout/retry", {"reference": ref}, tok)
    L.check("retry on paid order -> rejected (409)", st == 409, f"status={st} {rresp}")
    msg = (rresp or {}).get("detail", "") if isinstance(rresp, dict) else str(rresp)
    L.check("rejection says already paid", "already paid" in msg.lower(), msg)

    # ============ ZERO-TOTAL (100% promo) ====================================
    ga2 = h.seed_ticket_type(event_id=c.event_id, name=f"RT-FREE-{run}", price_minor=25000,
                             capacity=10, max_per_order=10)
    free_code = f"FREE100-{run}".upper()
    h.seed_promo(code=free_code, kind=h.PROMO_PERCENT, discount_pct="100", event_id=c.event_id)
    tokf, uidf, emailf = h.register_user("free")
    st, fresp = h.rest("POST", "/api/checkout/create",
                       {"eventId": c.event_id, "customerEmail": emailf, "promoCode": free_code,
                        "lines": [{"ticketTypeId": ga2, "quantity": 1}]}, tokf)
    L.check("zero-total create -> 200", st == 200, f"status={st} {fresp}")
    fref = fresp["order"]["reference"]
    L.check("zero-total total = 0 øre", fresp["order"]["totalMinor"] == 0, str(fresp["order"]["totalMinor"]))
    # redirect should be the return page WITHOUT a provider redirect (?reference=... appended).
    L.check("zero-total redirect = return page (no provider redirect)",
            "reference=" in fresp["redirectUrl"] and "checkout" in fresp["redirectUrl"].lower(),
            fresp["redirectUrl"])
    # tickets issued immediately, Payment Captured amount 0
    L.check("zero-total: 1 ticket issued immediately", len(h.tickets_for_ref(fref)) == 1, "")
    forder = h.order_by_ref(fref)
    L.check("zero-total order -> Fulfilled(5) immediately", forder["Status"] == h.ORD_FULFILLED, str(forder["Status"]))
    fpay = h.payments_by_ref_prefix(fref)[0]
    L.check("zero-total Payment Captured(6), amount 0",
            fpay["Status"] == h.PAY_CAPTURED and fpay["CapturedAmountMinor"] == 0,
            f"status={fpay['Status']} captured={fpay['CapturedAmountMinor']}")

    L.done()


if __name__ == "__main__":
    main()
