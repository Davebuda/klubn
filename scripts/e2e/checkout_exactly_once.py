"""E2E 3/5 — EXACTLY-ONCE issuance under racing finalize paths (design §3.5/§8/§7).

The webhook and the reconcile poll share PaymentOrchestrator.FinalizeAsync. Both can clear
the layer-0 dedup row (they carry DIFFERENT PspRefs: the webhook's chosen pspRef vs the
sandbox poll's "sbx-psp-{ref}"), so exactly-once rests on the payment-level + order-level CAS.
This proves that firing BOTH back-to-back (and again in reverse order on a second order)
issues exactly one ticket set, records exactly one Captured payment, and the webhook dedup
table holds exactly the rows we expect.

Also: a bad webhook signature -> 401 and NOTHING changes; a replayed webhook -> 200 no-op.
"""
import _harness as h


def create_order(c, tok, email, ga, qty=1):
    st, resp = h.rest("POST", "/api/checkout/create",
                      {"eventId": c.event_id, "customerEmail": email,
                       "lines": [{"ticketTypeId": ga, "quantity": qty}]}, tok)
    if st != 200:
        raise RuntimeError(f"create failed {st}: {resp}")
    return resp["order"]["reference"]


def main():
    c = h.cfg()
    L = h.Ledger("checkout_exactly_once")
    run = h.uniq()
    ga = h.seed_ticket_type(event_id=c.event_id, name=f"XO-GA-{run}", price_minor=25000,
                            capacity=50, max_per_order=10)
    tok, uid, email = h.register_user("xo")

    # ============ A. bad signature changes nothing ============================
    ref0 = create_order(c, tok, email, ga, qty=1)
    body0 = {"orderRef": ref0, "pspRef": f"psp-{ref0}", "type": "Captured",
             "amountMinor": 25000, "currency": "NOK"}
    # Forge a wrong signature: valid hex, wrong bytes (webhook() signs correctly by default).
    bad_sig = "00" * 32
    status = h.webhook("sandbox", body0, sig=bad_sig)
    L.check("bad signature -> 401", status == 401, f"status={status}")
    status = h.webhook("sandbox", body0, sig=False)  # missing header
    L.check("missing signature -> 401", status == 401, f"status={status}")
    # DB-truth: still Created, no tickets, no dedup row, holds intact.
    pay = h.payments_by_ref_prefix(ref0)
    L.check("after bad sig: payment still Created, not Captured",
            len(pay) == 1 and pay[0]["Status"] == h.PAY_CREATED, str([p["Status"] for p in pay]))
    L.check("after bad sig: zero tickets", len(h.tickets_for_ref(ref0)) == 0, "")
    con = h.db()
    dedup0 = con.execute("SELECT COUNT(*) FROM PaymentWebhookEvents WHERE ProviderPspReference = ?",
                         (f"psp-{ref0}",)).fetchone()[0]
    con.close()
    L.check("after bad sig: zero dedup rows", dedup0 == 0, str(dedup0))

    # ============ B. webhook THEN reconcile, back-to-back =====================
    ref1 = create_order(c, tok, email, ga, qty=2)
    body1 = {"orderRef": ref1, "pspRef": f"psp-{ref1}", "type": "Captured",
             "amountMinor": 50000, "currency": "NOK"}
    s1 = h.webhook("sandbox", body1)
    # reconcile poll (its own finalize path; sandbox GetStatus reports Authorized -> capture)
    r = h.gql("""mutation($ref: String!){ reconcileTicketOrder(reference:$ref){
                   reference status paymentState totalMinor } }""", {"ref": ref1}, tok)
    rec = (r.get("data") or {}).get("reconcileTicketOrder")
    L.check("order1 webhook -> 200", s1 == 200, f"status={s1}")
    L.check("order1 reconcile -> returns status", bool(rec), str(r.get("errors") or rec))
    tickets1 = h.tickets_for_ref(ref1)
    L.check("order1: EXACTLY 2 tickets (one set, not double)", len(tickets1) == 2, str(len(tickets1)))
    pay1 = h.payments_by_ref_prefix(ref1)
    captured1 = [p for p in pay1 if p["Status"] == h.PAY_CAPTURED]
    L.check("order1: exactly ONE Captured payment", len(captured1) == 1,
            str([(p["ProviderReference"], p["Status"]) for p in pay1]))
    # Per-ORDER exactly-once on inventory: this order has exactly ONE hold and it is
    # Committed (not double-committed). Global counters are NOT asserted here because the
    # bad-sig order (A) intentionally leaves a still-Active hold, and re-runs accumulate
    # rows — global Sold/Held would couple this test to unrelated orders. The hold-state
    # check is the precise exactly-once proof for THIS order's inventory.
    holds1 = h.holds_for_ref(ref1)
    L.check("order1: exactly ONE hold, Committed, qty 2 (inventory committed once)",
            len(holds1) == 1 and holds1[0]["Status"] == h.HOLD_COMMITTED and holds1[0]["Quantity"] == 2,
            str([dict(r) for r in holds1]))

    # ============ C. reconcile THEN webhook, reverse order, 2nd order =========
    ref2 = create_order(c, tok, email, ga, qty=1)
    body2 = {"orderRef": ref2, "pspRef": f"psp-{ref2}", "type": "Captured",
             "amountMinor": 25000, "currency": "NOK"}
    r = h.gql("""mutation($ref: String!){ reconcileTicketOrder(reference:$ref){ paymentState } }""",
              {"ref": ref2}, tok)
    rec2 = (r.get("data") or {}).get("reconcileTicketOrder")
    s2 = h.webhook("sandbox", body2)
    L.check("order2 reconcile-first -> captured", rec2 and rec2["paymentState"] == "Captured",
            str(r.get("errors") or rec2))
    L.check("order2 webhook-second -> 200 (no-op)", s2 == 200, f"status={s2}")
    tickets2 = h.tickets_for_ref(ref2)
    L.check("order2: EXACTLY 1 ticket", len(tickets2) == 1, str(len(tickets2)))
    pay2 = h.payments_by_ref_prefix(ref2)
    captured2 = [p for p in pay2 if p["Status"] == h.PAY_CAPTURED]
    L.check("order2: exactly ONE Captured payment", len(captured2) == 1,
            str([(p["ProviderReference"], p["Status"]) for p in pay2]))

    # ============ D. replayed webhook -> 200 + no-op ==========================
    s3 = h.webhook("sandbox", body2)
    L.check("order2 replayed webhook -> 200", s3 == 200, f"status={s3}")
    L.check("order2: still 1 ticket after replay", len(h.tickets_for_ref(ref2)) == 1, "")

    # ============ E. dedup table sanity ======================================
    # The webhook leg inserts a dedup row keyed on its pspRef; the reconcile leg inserts a
    # row keyed on the sandbox poll pspRef ("sbx-psp-{ref}"). Exactly-once is enforced by the
    # CAS, NOT by these being the same row — so assert the webhook's own dedup row is unique.
    con = h.db()
    d1 = con.execute("SELECT COUNT(*) FROM PaymentWebhookEvents WHERE ProviderPspReference = ? AND EventType='Captured'",
                     (f"psp-{ref1}",)).fetchone()[0]
    d2 = con.execute("SELECT COUNT(*) FROM PaymentWebhookEvents WHERE ProviderPspReference = ? AND EventType='Captured'",
                     (f"psp-{ref2}",)).fetchone()[0]
    con.close()
    L.check("order1 webhook dedup row count = 1 (replay deduped)", d1 == 1, str(d1))
    L.check("order2 webhook dedup row count = 1 (replay deduped)", d2 == 1, str(d2))

    L.done()


if __name__ == "__main__":
    main()
