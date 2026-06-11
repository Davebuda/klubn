"""E2E 1/5 — checkout QUOTE (stateless pricing; design §4.2/§5/§4.1).

Proves the quote surface prices a selection WITHOUT any side effect, applies promo discount
math to exact øre, surfaces an invalid promo as ok=false + UNDISCOUNTED totals (never fails
the quote), hides hidden tiers unless an unlock promo is supplied, and rejects oversell.
Covers REST /api/checkout/quote (anonymous) with a GraphQL quoteTicketOrder parity check.

DB-truth guard: a final assertion confirms quote created ZERO Orders / PromoRedemptions.
"""
import _harness as h


def main():
    c = h.cfg()
    L = h.Ledger("checkout_quote")

    run = h.uniq()
    # Multi-tier seed: GA (cap 50) and VIP (cap 20), plus a HIDDEN tier (cap 10).
    ga = h.seed_ticket_type(event_id=c.event_id, name=f"GA-{run}", price_minor=25000,
                            capacity=50, max_per_order=10)
    vip = h.seed_ticket_type(event_id=c.event_id, name=f"VIP-{run}", price_minor=50000,
                             capacity=20, max_per_order=10)
    hidden = h.seed_ticket_type(event_id=c.event_id, name=f"HID-{run}", price_minor=30000,
                                capacity=10, max_per_order=10, is_hidden=True)

    # Promos: a 10% percent code scoped to GA only; a wildcard 10% code (all tiers); an
    # unlock code that opens the hidden tier (and discounts it 10%).
    pct10_ga = f"PCT10GA{run}".upper()
    h.seed_promo(code=pct10_ga, kind=h.PROMO_PERCENT, discount_pct="10",
                 event_id=c.event_id, ticket_type_ids=[ga])
    unlock = f"UNLOCK{run}".upper()
    h.seed_promo(code=unlock, kind=h.PROMO_PERCENT, discount_pct="10", event_id=c.event_id,
                 unlocks_hidden=True, ticket_type_ids=[hidden])

    # Snapshot side-effect tables BEFORE any quote (DB-truth: quote must not write).
    con = h.db()
    orders_before = con.execute("SELECT COUNT(*) FROM Orders").fetchone()[0]
    red_before = con.execute("SELECT COUNT(*) FROM PromoRedemptions").fetchone()[0]
    con.close()

    # ---- 1. multi-tier quote, no promo --------------------------------------
    st, q = h.rest("POST", "/api/checkout/quote",
                   {"eventId": c.event_id,
                    "lines": [{"ticketTypeId": ga, "quantity": 2},
                              {"ticketTypeId": vip, "quantity": 1}]})
    L.check("multi-tier quote -> 200 ok", st == 200 and q.get("ok") is True, f"status={st} {q}")
    # GA 2*25000 + VIP 1*50000 = 100000 gross, no discount.
    L.check("multi-tier total = 100000 øre", q.get("totalMinor") == 100000, str(q.get("totalMinor")))
    L.check("multi-tier discount = 0", q.get("discountMinor") == 0, str(q.get("discountMinor")))
    # subtotal+vat == total
    L.check("subtotal + vat == total",
            q.get("subtotalMinor", 0) + q.get("vatMinor", 0) == q.get("totalMinor"),
            f"sub={q.get('subtotalMinor')} vat={q.get('vatMinor')} total={q.get('totalMinor')}")

    # ---- 2. valid percent promo (the exact-øre VAT case from the spec) -------
    # 1x GA @ 25000, 12% VAT-inclusive, 10% off:
    #   lineGross=25000; discount=round(25000*0.10)=2500; discountedGross=22500
    #   net=round(22500/1.12)=20089; vat=22500-20089=2411; lineTotal=22500
    st, q = h.rest("POST", "/api/checkout/quote",
                   {"eventId": c.event_id, "promoCode": pct10_ga,
                    "lines": [{"ticketTypeId": ga, "quantity": 1}]})
    L.check("valid promo quote -> 200", st == 200 and q.get("ok") is True, f"status={st}")
    L.check("promo sub-object ok=true", (q.get("promo") or {}).get("ok") is True, str(q.get("promo")))
    L.check("discounted line total = 22500 øre", q.get("totalMinor") == 22500, str(q.get("totalMinor")))
    L.check("discount = 2500 øre", q.get("discountMinor") == 2500, str(q.get("discountMinor")))
    L.check("net = 20089 øre", q.get("subtotalMinor") == 20089, str(q.get("subtotalMinor")))
    L.check("vat (on discounted gross) = 2411 øre", q.get("vatMinor") == 2411, str(q.get("vatMinor")))
    line = (q.get("lines") or [{}])[0]
    L.check("line.lineGrossMinor = 25000", line.get("lineGrossMinor") == 25000, str(line.get("lineGrossMinor")))
    L.check("line.discountMinor = 2500", line.get("discountMinor") == 2500, str(line.get("discountMinor")))
    L.check("line.lineTotalMinor = 22500", line.get("lineTotalMinor") == 22500, str(line.get("lineTotalMinor")))

    # ---- 2b. GraphQL parity for the discounted case -------------------------
    r = h.gql("""query($i: QuoteTicketOrderInput!){ quoteTicketOrder(input:$i){
                   ok totalMinor discountMinor subtotalMinor vatMinor
                   promo { ok code } lines { lineTotalMinor discountMinor } } }""",
              {"i": {"eventId": c.event_id, "promoCode": pct10_ga,
                     "lines": [{"ticketTypeId": ga, "quantity": 1}]}})
    gq = (r.get("data") or {}).get("quoteTicketOrder") or {}
    L.check("GraphQL parity: total 22500", gq.get("totalMinor") == 22500, str(r.get("errors") or gq))
    L.check("GraphQL parity: discount 2500 / vat 2411",
            gq.get("discountMinor") == 2500 and gq.get("vatMinor") == 2411,
            f"d={gq.get('discountMinor')} v={gq.get('vatMinor')}")
    L.check("GraphQL parity: promo.ok true", (gq.get("promo") or {}).get("ok") is True, str(gq.get("promo")))

    # ---- 3. invalid promo -> ok=false + UNDISCOUNTED totals -----------------
    st, q = h.rest("POST", "/api/checkout/quote",
                   {"eventId": c.event_id, "promoCode": f"NOPE{run}".upper(),
                    "lines": [{"ticketTypeId": ga, "quantity": 1}]})
    L.check("invalid promo: quote still 200 + selection ok=true", st == 200 and q.get("ok") is True, f"status={st}")
    L.check("invalid promo: promo.ok=false + reason",
            (q.get("promo") or {}).get("ok") is False and bool((q.get("promo") or {}).get("reason")),
            str(q.get("promo")))
    L.check("invalid promo: totals UNDISCOUNTED (25000, discount 0)",
            q.get("totalMinor") == 25000 and q.get("discountMinor") == 0,
            f"total={q.get('totalMinor')} discount={q.get('discountMinor')}")

    # ---- 4. hidden tier WITHOUT unlock -> sold-out/not-found reason ----------
    st, q = h.rest("POST", "/api/checkout/quote",
                   {"eventId": c.event_id,
                    "lines": [{"ticketTypeId": hidden, "quantity": 1}]})
    L.check("hidden tier no-unlock: 200 + ok=false", st == 200 and q.get("ok") is False, f"status={st} {q}")
    L.check("hidden tier no-unlock: not-found reason (no existence leak)",
            "not found" in (q.get("reason") or "").lower(), str(q.get("reason")))

    # ---- 5. hidden tier WITH unlock promo -> quoted -------------------------
    st, q = h.rest("POST", "/api/checkout/quote",
                   {"eventId": c.event_id, "promoCode": unlock,
                    "lines": [{"ticketTypeId": hidden, "quantity": 1}]})
    L.check("hidden tier WITH unlock: 200 + ok=true", st == 200 and q.get("ok") is True, f"status={st} {q}")
    # 30000 @ 12%, 10% off -> discount 3000, total 27000.
    L.check("unlocked hidden discounted total = 27000", q.get("totalMinor") == 27000, str(q.get("totalMinor")))
    L.check("unlocked hidden: promo.ok=true", (q.get("promo") or {}).get("ok") is True, str(q.get("promo")))

    # ---- 6. oversell quantity -> reason -------------------------------------
    st, q = h.rest("POST", "/api/checkout/quote",
                   {"eventId": c.event_id,
                    "lines": [{"ticketTypeId": vip, "quantity": 999}]})
    # 999 > maxPerOrder(10) trips the max rule first (also a valid "can't buy this" reason).
    L.check("oversell qty: 200 + ok=false + reason",
            st == 200 and q.get("ok") is False and bool(q.get("reason")), f"status={st} {q}")

    # ---- 7. DB-truth: quotes wrote NOTHING ----------------------------------
    con = h.db()
    orders_after = con.execute("SELECT COUNT(*) FROM Orders").fetchone()[0]
    red_after = con.execute("SELECT COUNT(*) FROM PromoRedemptions").fetchone()[0]
    con.close()
    L.check("quote created ZERO Orders", orders_after == orders_before,
            f"before={orders_before} after={orders_after}")
    L.check("quote created ZERO PromoRedemptions", red_after == red_before,
            f"before={red_before} after={red_after}")

    L.done()


if __name__ == "__main__":
    main()
