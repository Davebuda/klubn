using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace DJDiP.Tests
{
    // C4 orchestrator integration tests over REAL in-memory SQLite (the raw CAS SQL is the
    // thing under test). Coverage: promo reservation success + rollback when the code is
    // exhausted, zero-total (100% promo) immediate issuance, retry reference format, retry
    // rejection on a paid order, and the §3.5 order-level CAS that makes a duplicate capture
    // across two attempts issue exactly once + auto-refund the loser.
    public class PaymentOrchestratorCheckoutTests
    {
        private static IReadOnlyList<OrderLineRequest> Line(Guid typeId, int qty = 1) =>
            new[] { new OrderLineRequest(typeId, qty) };

        // ---- promo reservation ------------------------------------------------------

        [Fact]
        public async Task Create_with_valid_promo_reserves_usage_and_snapshots_discount()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();
            var promo = h.SeedPromo(code: "SAVE10", pct: 10, maxRedemptions: 5, usageCount: 0);

            // 10% off a single 500.00 line => 50.00 discount.
            h.Promo.Result = new PromoValidationResult
            {
                Ok = true,
                Code = "SAVE10",
                PromoCodeId = promo.Id,
                DiscountMinor = 5000,
                PerLineDiscounts = new[] { new PromoLineDiscount(type.Id, 5000) }
            };

            var result = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), customerEmail: null, actingUserId: user.Id,
                promoCode: "SAVE10", provider: null, CancellationToken.None);

            Assert.Equal(45000, result.Order.TotalMinor);

            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == result.Order.Reference);
            Assert.Equal(promo.Id, order.PromotionCodeId);
            Assert.Equal(5000, order.DiscountMinor);
            Assert.Equal(450.00m, order.TotalAmount);

            // UsageCount reserved (0 -> 1) and a Reserved redemption row exists.
            var freshPromo = await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id);
            Assert.Equal(1, freshPromo.UsageCount);
            var redemption = await h.Db.PromoRedemptions.AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Reserved, redemption.Status);
        }

        [Fact]
        public async Task Create_rolls_back_inventory_when_promo_already_exhausted()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();
            // Promo is at its cap already: UsageCount == MaxRedemptions, so the reservation CAS
            // affects 0 rows. (The validator is faked Ok to drive the orchestrator's own CAS.)
            var promo = h.SeedPromo(code: "MAXED", pct: 10, maxRedemptions: 1, usageCount: 1);
            h.Promo.Result = new PromoValidationResult
            {
                Ok = true, Code = "MAXED", PromoCodeId = promo.Id, DiscountMinor = 5000,
                PerLineDiscounts = new[] { new PromoLineDiscount(type.Id, 5000) }
            };

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                h.Orchestrator.CreatePaymentAsync(
                    eventId, Line(type.Id), null, user.Id, "MAXED", null, CancellationToken.None));
            Assert.Equal("This code is no longer available.", ex.Message);

            // The WHOLE transaction rolled back: no order, no held inventory, usage unchanged.
            Assert.Empty(await h.Db.Orders.AsNoTracking().ToListAsync());
            var freshType = await h.Db.TicketTypes.AsNoTracking().FirstAsync(t => t.Id == type.Id);
            Assert.Equal(0, freshType.QuantityHeld);
            var freshPromo = await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id);
            Assert.Equal(1, freshPromo.UsageCount); // untouched
        }

        [Fact]
        public async Task Create_with_invalid_promo_is_a_hard_error()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent();
            var user = h.SeedUser();
            h.Promo.Result = PromoValidationResult.Fail("NOPE", "This code has expired.");

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                h.Orchestrator.CreatePaymentAsync(
                    eventId, Line(type.Id), null, user.Id, "NOPE", null, CancellationToken.None));
            Assert.Equal("This code has expired.", ex.Message);
            Assert.Empty(await h.Db.Orders.AsNoTracking().ToListAsync());
        }

        // ---- provider validation ----------------------------------------------------

        [Fact]
        public async Task Create_with_unknown_provider_throws_before_any_state()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent();
            var user = h.SeedUser();

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                h.Orchestrator.CreatePaymentAsync(
                    eventId, Line(type.Id), null, user.Id, null, "Klarna", CancellationToken.None));
            Assert.Equal("Unknown payment provider.", ex.Message);
            Assert.Empty(await h.Db.Orders.AsNoTracking().ToListAsync());
        }

        // ---- zero-total (100% promo) ------------------------------------------------

        [Fact]
        public async Task Create_with_full_discount_issues_immediately_without_initiate()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();
            var promo = h.SeedPromo(code: "FREE", kind: PromoKind.FixedAmount, pct: 0, amountMinor: 50000, maxRedemptions: 5);
            h.Promo.Result = new PromoValidationResult
            {
                Ok = true, Code = "FREE", PromoCodeId = promo.Id, DiscountMinor = 50000,
                PerLineDiscounts = new[] { new PromoLineDiscount(type.Id, 50000) }
            };

            var result = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, "FREE", null, CancellationToken.None);

            Assert.Equal(0, result.Order.TotalMinor);
            // Provider InitiateAsync is SKIPPED for a free order.
            Assert.Empty(h.Provider.Initiated);

            // Finalized through the synthetic free-capture: order Fulfilled, ticket issued,
            // payment Captured, promo Consumed, confirmation email fired once.
            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == result.Order.Reference);
            Assert.Equal(OrderStatus.Fulfilled, order.Status);
            var payment = await h.Db.Payments.AsNoTracking().FirstAsync(p => p.OrderId == order.Id);
            Assert.Equal(PaymentStatus.Captured, payment.Status);
            Assert.Equal(1, await h.Db.Tickets.AsNoTracking().CountAsync(t => t.UserId == user.Id));
            var redemption = await h.Db.PromoRedemptions.AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Consumed, redemption.Status);
            Assert.Contains(order.Id, h.Confirmation.Sent);
        }

        // ---- retry ------------------------------------------------------------------

        [Fact]
        public async Task Retry_creates_second_attempt_with_r2_reference()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, null, null, CancellationToken.None);

            var retry = await h.Orchestrator.RetryPaymentAsync(
                created.Order.Reference, provider: null, actingUserId: user.Id, CancellationToken.None);

            Assert.Equal(created.Order.Reference, retry.Order.Reference);

            var payments = await h.Db.Payments.AsNoTracking()
                .Where(p => p.ProviderReference == created.Order.Reference || p.ProviderReference.StartsWith(created.Order.Reference + "-r"))
                .OrderBy(p => p.AttemptNo).ToListAsync();
            Assert.Equal(2, payments.Count);
            Assert.Equal(1, payments[0].AttemptNo);
            Assert.Equal(created.Order.Reference, payments[0].ProviderReference);
            Assert.Equal(PaymentStatus.Aborted, payments[0].Status); // previous attempt cancelled
            Assert.Equal(2, payments[1].AttemptNo);
            Assert.Equal($"{created.Order.Reference}-r2", payments[1].ProviderReference);
            Assert.Equal(PaymentStatus.Created, payments[1].Status);

            // The previous attempt was best-effort cancelled at the provider.
            Assert.Contains(created.Order.Reference, h.Provider.Cancelled);
        }

        [Fact]
        public async Task Retry_rejected_on_a_paid_order()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, null, null, CancellationToken.None);

            // Capture the order (drives it to Fulfilled / payment Captured).
            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                OrderRef: created.Order.Reference, PspRef: "psp-1",
                Type: PaymentEventType.Captured, Amount: Money.Nok(50000),
                OccurredAt: DateTime.UtcNow, RawPayload: "{}"), CancellationToken.None);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                h.Orchestrator.RetryPaymentAsync(created.Order.Reference, null, user.Id, CancellationToken.None));
            Assert.Equal("This order is already paid.", ex.Message);
        }

        [Fact]
        public async Task Retry_rejected_for_a_different_user()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent();
            var owner = h.SeedUser();
            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, owner.Id, null, null, CancellationToken.None);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                h.Orchestrator.RetryPaymentAsync(created.Order.Reference, null, "someone-else", CancellationToken.None));
            Assert.Equal("You can only retry your own order.", ex.Message);
        }

        // ---- §3.5 duplicate capture across two attempts -----------------------------

        [Fact]
        public async Task Two_attempts_both_captured_issue_once_and_refund_the_loser()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, null, null, CancellationToken.None);
            var ref1 = created.Order.Reference;

            // A second attempt (-r2) before either captures.
            var retry = await h.Orchestrator.RetryPaymentAsync(ref1, null, user.Id, CancellationToken.None);
            var ref2 = $"{ref1}-r2";

            // Attempt 1 captures first → issues. Distinct PspRefs so layer-0 dedup lets both
            // through to the order-level CAS.
            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                ref1, "psp-a", PaymentEventType.Captured, Money.Nok(50000), DateTime.UtcNow, "{}"),
                CancellationToken.None);
            // Attempt 2 captures second → order already Fulfilled → refunded, NOT issued again.
            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                ref2, "psp-b", PaymentEventType.Captured, Money.Nok(50000), DateTime.UtcNow, "{}"),
                CancellationToken.None);

            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == ref1);
            Assert.Equal(OrderStatus.Fulfilled, order.Status);

            // Exactly ONE issuance: one ticket for a qty-1 order.
            Assert.Equal(1, await h.Db.Tickets.AsNoTracking().CountAsync(t => t.UserId == user.Id));

            // Both payments are Captured (money was taken twice), but only attempt 2 refunded.
            var p1 = await h.Db.Payments.AsNoTracking().FirstAsync(p => p.ProviderReference == ref1);
            var p2 = await h.Db.Payments.AsNoTracking().FirstAsync(p => p.ProviderReference == ref2);
            Assert.Equal(PaymentStatus.Captured, p1.Status);
            Assert.Equal(PaymentStatus.Captured, p2.Status);

            Assert.Single(h.Provider.Refunds);
            Assert.Equal(ref2, h.Provider.Refunds[0].Ref);
            Assert.Equal(ref2 + "-dup-refund", h.Provider.Refunds[0].IdemKey);
            Assert.Equal(50000, h.Provider.Refunds[0].Amount.AmountMinor);

            // Confirmation email fired exactly once (the winning issuance only).
            Assert.Single(h.Confirmation.Sent);
        }

        // ---- release path (promo reservation released on expiry) --------------------

        [Fact]
        public async Task Expire_releases_holds_and_promo_reservation()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();
            var promo = h.SeedPromo(code: "SAVE10", pct: 10, maxRedemptions: 5, usageCount: 0);
            h.Promo.Result = new PromoValidationResult
            {
                Ok = true, Code = "SAVE10", PromoCodeId = promo.Id, DiscountMinor = 5000,
                PerLineDiscounts = new[] { new PromoLineDiscount(type.Id, 5000) }
            };

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, "SAVE10", null, CancellationToken.None);

            // Reserved before expiry.
            Assert.Equal(1, (await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id)).UsageCount);

            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                created.Order.Reference, null, PaymentEventType.Expired, Money.Nok(0), DateTime.UtcNow, "{}"),
                CancellationToken.None);

            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == created.Order.Reference);
            Assert.Equal(OrderStatus.Expired, order.Status);
            // Inventory hold released and promo usage decremented (floor 0), redemption Released.
            Assert.Equal(0, (await h.Db.TicketTypes.AsNoTracking().FirstAsync(t => t.Id == type.Id)).QuantityHeld);
            Assert.Equal(0, (await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id)).UsageCount);
            var redemption = await h.Db.PromoRedemptions.AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Released, redemption.Status);
        }
    }
}
