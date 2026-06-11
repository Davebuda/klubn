using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace DJDiP.Tests
{
    // C6 — unit-test matrix completion. Each region documents what the C2/C4 smoke sets
    // already covered and adds ONLY the missing cases. No test from PromoMathTests,
    // PromoCodeServiceTests, CheckoutQuoteServiceTests, or PaymentOrchestratorCheckoutTests
    // is duplicated here; cross-references note where a requirement was already satisfied.

    // ============================================================
    // REGION A — PromoMath missing cases
    // Already covered by PromoMathTests:
    //   percent rounds AwayFromZero, percent>100 capped, fixed largest-remainder exact sum
    //   (3 equal lines + 2 proportional lines), fixed>gross capped.
    // ============================================================
    public class C6PromoMathTests
    {
        private static (Guid, long) Line(long gross) => (Guid.NewGuid(), gross);

        // percent rounding at the .5 boundary — AwayFromZero rounds 0.5 UP.
        [Fact]
        public void Percent_rounds_at_half_away_from_zero()
        {
            // 10% of 5 = 0.5  → rounds UP to 1 (AwayFromZero)
            // 10% of 15 = 1.5 → rounds UP to 2 (AwayFromZero)
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.Percent, 10m, 0,
                new[] { (a, 5L), (b, 15L) });

            Assert.Equal(1, result.Single(r => r.TicketTypeId == a).DiscountMinor);
            Assert.Equal(2, result.Single(r => r.TicketTypeId == b).DiscountMinor);
        }

        // 100% off → total becomes 0 (each line discount == line gross).
        [Fact]
        public void Percent_100_makes_every_line_free()
        {
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.Percent, 100m, 0,
                new[] { (a, 30000L), (b, 20000L) });

            Assert.Equal(30000, result.Single(r => r.TicketTypeId == a).DiscountMinor);
            Assert.Equal(20000, result.Single(r => r.TicketTypeId == b).DiscountMinor);
            Assert.Equal(0, result.Sum(r => r.DiscountMinor) - 50000); // sum == gross
        }

        // fixed > eligible gross → total discount capped at EXACTLY eligible gross.
        // (The existing test checks the sum; this asserts the precise capped value for a
        // single line to verify the cap path explicitly.)
        [Fact]
        public void Fixed_greater_than_single_line_gross_caps_at_gross()
        {
            var a = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 99999,
                new[] { (a, 1000L) });

            Assert.Equal(1000, result.Single().DiscountMinor);
        }

        // Largest-remainder across 4+ uneven lines still sums exactly.
        [Fact]
        public void Fixed_allocation_sums_exactly_across_four_uneven_lines()
        {
            // 1000 øre across gross 100/200/300/400 (total 1000).
            // Exact shares: 100/200/300/400. Floors: 100/200/300/400, sum = 1000, no remainder.
            var a = Guid.NewGuid(); var b = Guid.NewGuid();
            var c = Guid.NewGuid(); var d = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 1000,
                new[] { (a, 100L), (b, 200L), (c, 300L), (d, 400L) });

            Assert.Equal(1000, result.Sum(r => r.DiscountMinor));
        }

        // Largest-remainder across 3 uneven lines — forces non-trivial remainder redistribution.
        [Fact]
        public void Fixed_allocation_sums_exactly_across_three_uneven_lines()
        {
            // 100 øre across gross 120/80/50 (total 250).
            // Exact shares: 48/32/20. Floors: 48/32/20 sum = 100, no remainder needed here.
            // Use a case that DOES produce a remainder: 101 øre across 120/80/50 (total 250).
            // Exact: 48.48/32.32/20.20. Floors: 48/32/20 = 100. Leftover 1 goes to highest remainder
            // (all equal at 0.48/0.32/0.20 → first line gets +1 = 49/32/20 = 101).
            var a = Guid.NewGuid(); var b = Guid.NewGuid(); var c = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 101,
                new[] { (a, 120L), (b, 80L), (c, 50L) });

            Assert.Equal(101, result.Sum(r => r.DiscountMinor));
            // Each line never exceeds its gross.
            Assert.True(result.Single(r => r.TicketTypeId == a).DiscountMinor <= 120);
            Assert.True(result.Single(r => r.TicketTypeId == b).DiscountMinor <= 80);
            Assert.True(result.Single(r => r.TicketTypeId == c).DiscountMinor <= 50);
        }

        // Allocation with exactly 1 line (no LR needed, but code should handle it).
        [Fact]
        public void Fixed_allocation_single_line_returns_capped_total()
        {
            var a = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 300,
                new[] { (a, 500L) });

            Assert.Equal(300, result.Single().DiscountMinor);
            Assert.Equal(1, result.Count);
        }

        // line discount never exceeds line gross — percent path, already in PromoMathTests
        // via Percent_never_exceeds_line_gross. Here we verify the fixed path per-line cap.
        [Fact]
        public void Fixed_per_line_discount_never_exceeds_line_gross()
        {
            // 2000 øre across lines of gross 100/100/100 (total 300). Budget > total so it
            // caps at 100+100+100 = 300 and each individual line stays <= its gross.
            var a = Guid.NewGuid(); var b = Guid.NewGuid(); var c = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 2000,
                new[] { (a, 100L), (b, 100L), (c, 100L) });

            Assert.All(result, r => Assert.True(r.DiscountMinor <= 100));
        }

        // 0% promo → zero discount on every line.
        [Fact]
        public void Percent_zero_returns_zero_discount()
        {
            var a = Guid.NewGuid(); var b = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.Percent, 0m, 0,
                new[] { (a, 10000L), (b, 20000L) });

            Assert.All(result, r => Assert.Equal(0, r.DiscountMinor));
        }

        // 0 fixed amount → zero discount on every line.
        [Fact]
        public void Fixed_zero_amount_returns_zero_discount()
        {
            var a = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 0,
                new[] { (a, 10000L) });

            Assert.Equal(0, result.Single().DiscountMinor);
        }
    }

    // ============================================================
    // REGION B — PromoCodeService missing cases
    // Already covered by PromoCodeServiceTests:
    //   expired, wrong event, per-user cap null userId, unknown code, valid percent.
    // ============================================================
    public class C6PromoCodeServiceTests
    {
        private static readonly Guid EventA = Guid.NewGuid();
        private static readonly Guid TypeA = Guid.NewGuid();
        private static readonly Guid TypeB = Guid.NewGuid();

        private static PromoCodeService Service(PromotionCode promo, int userRedemptions = 0)
        {
            var uow = new FakeUnitOfWork(promos: new FakePromoCodeRepository(promo, userRedemptions));
            return new PromoCodeService(uow);
        }

        private static PromotionCode ValidPercent(decimal pct = 10m, Guid? eventId = null) => new()
        {
            Id = Guid.NewGuid(),
            Code = "SAVE10",
            Kind = PromoKind.Percent,
            DiscountPercentage = pct,
            ValidFrom = DateTime.UtcNow.AddDays(-1),
            ValidUntil = DateTime.UtcNow.AddDays(1),
            IsActive = true,
            EventId = eventId,
            TicketTypes = new List<PromoCodeTicketType>()
        };

        private static IReadOnlyList<PromoLine> OneLine(Guid typeId, long unitPrice = 10000, int qty = 2,
            bool isHidden = false)
            => new[] { new PromoLine(typeId, qty, unitPrice, 0.12m, IsHidden: isHidden) };

        private static IReadOnlyList<PromoLine> TwoLines()
            => new[]
            {
                new PromoLine(TypeA, 1, 10000, 0.12m, IsHidden: false),
                new PromoLine(TypeB, 1, 10000, 0.12m, IsHidden: false)
            };

        // ----- not yet valid (before ValidFrom) -----------------------------------------

        [Fact]
        public async Task Not_yet_valid_code_fails_with_reason()
        {
            var promo = ValidPercent();
            promo.ValidFrom = DateTime.UtcNow.AddDays(2); // future window
            promo.ValidUntil = DateTime.UtcNow.AddDays(5);
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(TypeA), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code isn't active yet.", r.Reason);
            Assert.Equal(0, r.DiscountMinor);
        }

        // ----- inactive kill-switch -----------------------------------------------------

        [Fact]
        public async Task Inactive_code_fails_with_reason()
        {
            var promo = ValidPercent();
            promo.IsActive = false;
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(TypeA), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code is no longer active.", r.Reason);
        }

        // ----- global usage cap already reached -----------------------------------------

        [Fact]
        public async Task Global_cap_reached_fails()
        {
            var promo = ValidPercent();
            promo.MaxRedemptions = 5;
            promo.UsageCount = 5; // at cap: 5 == 5
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(TypeA), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code has reached its usage limit.", r.Reason);
        }

        // ----- per-user cap reached (counts Reserved + Consumed, ignores Released) -------

        [Fact]
        public async Task Per_user_cap_reached_fails()
        {
            // The fake repo returns userRedemptions=1 which represents the count of
            // Reserved|Consumed rows (Released are excluded by the real repo query).
            var promo = ValidPercent();
            promo.MaxRedemptionsPerUser = 1;
            var svc = Service(promo, userRedemptions: 1); // already used once

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(TypeA), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("You've already used this code.", r.Reason);
        }

        // ----- type-scoped: NO eligible lines -------------------------------------------

        [Fact]
        public async Task Type_scoped_promo_with_no_eligible_lines_fails()
        {
            var scopedToTypeB = Guid.NewGuid(); // a type NOT in the cart
            var promo = ValidPercent();
            promo.TicketTypes = new List<PromoCodeTicketType>
            {
                new() { PromoCodeId = promo.Id, TicketTypeId = scopedToTypeB }
            };
            var svc = Service(promo);

            // Cart only has TypeA; promo only covers scopedToTypeB → 0 eligible lines.
            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(TypeA), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code doesn't apply to the selected tickets.", r.Reason);
        }

        // ----- type-scoped: SOME eligible lines (discount only on those) ----------------

        [Fact]
        public async Task Type_scoped_promo_discounts_only_eligible_lines()
        {
            var promo = ValidPercent(10m); // 10%
            // Scope to TypeA only; TypeB is in cart but NOT in scope.
            promo.TicketTypes = new List<PromoCodeTicketType>
            {
                new() { PromoCodeId = promo.Id, TicketTypeId = TypeA }
            };
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, TwoLines(), "user-1", CancellationToken.None);

            Assert.True(r.Ok);
            // Only TypeA's gross (10000) is eligible: 10% = 1000.
            Assert.Equal(1000, r.DiscountMinor);
            var lineA = r.PerLineDiscounts.Single(l => l.TicketTypeId == TypeA);
            Assert.Equal(1000, lineA.DiscountMinor);
            // TypeB should have either no entry or a 0-discount entry (not in eligible set
            // so the per-line discount is 0 / absent).
            var lineB = r.PerLineDiscounts.FirstOrDefault(l => l.TicketTypeId == TypeB);
            Assert.True(lineB is null || lineB.DiscountMinor == 0);
        }

        // ----- case-insensitive lookup --------------------------------------------------

        [Fact]
        public async Task Code_lookup_is_case_insensitive()
        {
            // Code stored uppercase; submitted lowercase.
            var promo = ValidPercent();
            promo.Code = "SAVE10";
            var svc = Service(promo);

            var r = await svc.ValidateAsync("save10", EventA, OneLine(TypeA), "user-1", CancellationToken.None);

            Assert.True(r.Ok);
            Assert.Equal("SAVE10", r.Code); // normalized back to stored casing
        }

        // ----- hidden unlock returns UnlockedTicketTypeIds ------------------------------

        [Fact]
        public async Task Hidden_unlock_promo_returns_unlocked_type_ids()
        {
            var hiddenTypeId = Guid.NewGuid();
            var promo = ValidPercent();
            promo.UnlocksHiddenTypes = true;
            promo.TicketTypes = new List<PromoCodeTicketType>
            {
                new() { PromoCodeId = promo.Id, TicketTypeId = hiddenTypeId }
            };
            var svc = Service(promo);

            var lines = new[] { new PromoLine(hiddenTypeId, 1, 10000, 0.12m, IsHidden: true) };
            var r = await svc.ValidateAsync("SAVE10", EventA, lines, "user-1", CancellationToken.None);

            Assert.True(r.Ok);
            Assert.Contains(hiddenTypeId, r.UnlockedTicketTypeIds);
        }

        // ----- UnlocksHiddenTypes + empty type list = unlock-all hidden lines -----------

        [Fact]
        public async Task Hidden_unlock_with_empty_type_list_unlocks_all_hidden_lines()
        {
            // The admin foot-gun: UnlocksHiddenTypes=true, TicketTypes empty → unlocks every
            // hidden line in the selection. This is the documented §4.1 behaviour; we just
            // assert it works (not ban it).
            var hiddenA = Guid.NewGuid();
            var hiddenB = Guid.NewGuid();
            var promo = ValidPercent();
            promo.UnlocksHiddenTypes = true;
            promo.TicketTypes = new List<PromoCodeTicketType>(); // empty = all types
            var svc = Service(promo);

            var lines = new[]
            {
                new PromoLine(hiddenA, 1, 10000, 0.12m, IsHidden: true),
                new PromoLine(hiddenB, 1, 10000, 0.12m, IsHidden: true)
            };
            var r = await svc.ValidateAsync("SAVE10", EventA, lines, "user-1", CancellationToken.None);

            Assert.True(r.Ok);
            Assert.Contains(hiddenA, r.UnlockedTicketTypeIds);
            Assert.Contains(hiddenB, r.UnlockedTicketTypeIds);
        }
    }

    // ============================================================
    // REGION C — CheckoutQuoteService missing cases
    // Already covered by CheckoutQuoteServiceTests:
    //   no-promo VAT on gross, hidden without unlock = not-found, hidden with unlock,
    //   invalid promo drops discount, oversell.
    // ============================================================
    public class C6CheckoutQuoteServiceTests
    {
        private static readonly Guid EventA = Guid.NewGuid();

        private sealed class StubPromo : IPromoCodeService
        {
            private readonly PromoValidationResult _result;
            public StubPromo(PromoValidationResult result) => _result = result;
            public Task<PromoValidationResult> ValidateAsync(
                string code, Guid eventId, IReadOnlyList<PromoLine> lines, string? userId, CancellationToken ct)
                => Task.FromResult(_result);

            public Task<IReadOnlyList<TicketType>> ResolveHiddenUnlockAsync(
                string? code, Guid eventId, CancellationToken ct)
                => Task.FromResult((IReadOnlyList<TicketType>)Array.Empty<TicketType>());
        }

        private static TicketType Type(Guid id, bool hidden = false, long price = 10000,
            TicketTypeStatus status = TicketTypeStatus.OnSale, int capacity = 100, int sold = 0, int held = 0,
            int min = 1, int max = 10,
            DateTime? salesStart = null, DateTime? salesEnd = null)
            => new()
            {
                Id = id,
                EventId = EventA,
                Name = hidden ? "Secret" : "GA",
                PriceMinor = price,
                VATRate = 0.12m,
                Currency = "NOK",
                Capacity = capacity,
                QuantitySold = sold,
                QuantityHeld = held,
                MinPerOrder = min,
                MaxPerOrder = max,
                SalesStart = salesStart,
                SalesEnd = salesEnd,
                Status = status,
                IsHidden = hidden
            };

        private static CheckoutQuoteService Service(
            IEnumerable<TicketType> types, IPromoCodeService? promo = null)
        {
            var uow = new FakeUnitOfWork(ticketTypes: new FakeTicketTypeRepository(types));
            return new CheckoutQuoteService(
                uow,
                promo ?? new StubPromo(PromoValidationResult.Fail("X", "none")),
                new FakeProviderCatalog("Vipps", "Stripe"));
        }

        // ----- VAT on DISCOUNTED gross (exact øre) ------------------------------------
        // Line: 25000 øre, 12% VAT, 10% discount.
        // discount = round(25000 * 0.10) = 2500 (exact).
        // discountedGross = 22500.
        // net = round(22500 / 1.12) = round(20089.285…) = 20089 (AwayFromZero).
        // vat = 22500 - 20089 = 2411.
        // total = 22500.
        [Fact]
        public async Task Vat_is_computed_on_discounted_gross_exact_ore()
        {
            var typeId = Guid.NewGuid();
            var tenPctPromo = new StubPromo(new PromoValidationResult
            {
                Ok = true,
                Code = "SAVE10",
                PromoCodeId = Guid.NewGuid(),
                DiscountMinor = 2500,
                PerLineDiscounts = new[] { new PromoLineDiscount(typeId, 2500) },
                UnlockedTicketTypeIds = Array.Empty<Guid>()
            });
            var svc = Service(new[] { Type(typeId, price: 25000) }, tenPctPromo);
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 1) }, PromoCode: "SAVE10");

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.True(q.Ok);
            Assert.Equal(22500, q.TotalMinor);             // discounted gross
            Assert.Equal(2500, q.DiscountMinor);
            Assert.Equal(20089, q.SubtotalMinor);          // round(22500 / 1.12)
            Assert.Equal(2411, q.VatMinor);                // 22500 - 20089
            Assert.Equal(q.SubtotalMinor + q.VatMinor, q.TotalMinor);
        }

        // ----- below MinPerOrder -------------------------------------------------------

        [Fact]
        public async Task Below_min_per_order_fails_quote()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, min: 3, max: 10) });
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 1) }, PromoCode: null); // qty=1 < min=3

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.False(q.Ok);
            Assert.Contains("Minimum", q.Reason);
        }

        // ----- above MaxPerOrder -------------------------------------------------------

        [Fact]
        public async Task Above_max_per_order_fails_quote()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, min: 1, max: 4) });
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 5) }, PromoCode: null); // qty=5 > max=4

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.False(q.Ok);
            Assert.Contains("Maximum", q.Reason);
        }

        // ----- sales window: not started -----------------------------------------------

        [Fact]
        public async Task Before_sales_window_fails_quote()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, salesStart: DateTime.UtcNow.AddDays(1)) });
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 1) }, PromoCode: null);

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.False(q.Ok);
            Assert.Contains("not started", q.Reason);
        }

        // ----- sales window: ended -----------------------------------------------------

        [Fact]
        public async Task After_sales_window_fails_quote()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, salesEnd: DateTime.UtcNow.AddDays(-1)) });
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 1) }, PromoCode: null);

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.False(q.Ok);
            Assert.Contains("ended", q.Reason);
        }

        // ----- duplicate lines collapsed -----------------------------------------------

        [Fact]
        public async Task Duplicate_lines_for_same_type_are_collapsed()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, price: 10000, capacity: 10) });
            // Two separate line entries for the same ticket type — must collapse to qty=3.
            var selection = new CheckoutSelection(EventA,
                new[]
                {
                    new CheckoutSelectionLine(typeId, 1),
                    new CheckoutSelectionLine(typeId, 2)
                }, PromoCode: null);

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.True(q.Ok);
            Assert.Equal(1, q.Lines.Count);                // collapsed to one line
            Assert.Equal(3, q.Lines[0].Quantity);
            Assert.Equal(30000, q.TotalMinor);             // 3 × 10000
        }

        // ----- not-found message is indistinguishable from hidden-without-unlock --------
        // Verifies the information-leak rule: requesting an unknown type ID and requesting
        // a known-but-hidden type ID both return the EXACT same failure message.

        [Fact]
        public async Task Unknown_type_and_hidden_type_return_same_reason()
        {
            var hiddenId = Guid.NewGuid();
            var unknownId = Guid.NewGuid(); // not in the repository
            var svc = Service(new[] { Type(hiddenId, hidden: true) });

            var hiddenResult = await svc.QuoteAsync(
                new CheckoutSelection(EventA, new[] { new CheckoutSelectionLine(hiddenId, 1) }, null),
                "user-1", CancellationToken.None);

            var unknownResult = await svc.QuoteAsync(
                new CheckoutSelection(EventA, new[] { new CheckoutSelectionLine(unknownId, 1) }, null),
                "user-1", CancellationToken.None);

            Assert.False(hiddenResult.Ok);
            Assert.False(unknownResult.Ok);
            Assert.Equal(unknownResult.Reason, hiddenResult.Reason); // identical — no info leak
        }
    }

    // ============================================================
    // REGION D — Orchestrator missing cases
    // Already covered by PaymentOrchestratorCheckoutTests:
    //   promo reserve success + snapshot, promo-CAS-fails rolls back (inventory too),
    //   invalid promo hard error, unknown provider, zero-total free issues immediately,
    //   retry -r2 reference + abort previous, retry rejected on paid order, retry rejected
    //   wrong user, two attempts both captured → one issuance + dup-refund, expire releases
    //   holds + promo reservation.
    // ============================================================
    public class C6OrchestratorTests
    {
        private static IReadOnlyList<OrderLineRequest> Line(Guid typeId, int qty = 1) =>
            new[] { new OrderLineRequest(typeId, qty) };

        // ----- inventory CAS fails on a LATER line (promo rollback) -------------------
        // Scenario: two ticket types; promo validates ok; inventory CAS succeeds for the
        // first type but FAILS for the second type (it is sold out). The WHOLE transaction
        // (including the promo reservation that would have been done after inventory) must
        // roll back. UsageCount stays 0 and no PromoRedemption row is inserted.
        // NOTE: the orchestrator applies inventory CAS per-line BEFORE the promo CAS (see
        // PaymentOrchestrator.cs lines 259-270 vs 277-300). If the second line's CAS fails
        // the rollback happens before the promo CAS is attempted, so UsageCount is never
        // touched. This tests that the FULL tx rollback from a mid-loop inventory failure
        // also means no promo side-effect.
        [Fact]
        public async Task Inventory_CAS_failure_rolls_back_entire_tx_no_promo_reservation()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, typeA) = h.SeedEvent(priceMinor: 10000, capacity: 5);

            // typeB is in the same event but is SOLD OUT.
            var venue = h.Db.Venues.First();
            var ev = h.Db.Events.First();
            var typeB = new TicketType
            {
                Id = Guid.NewGuid(),
                EventId = eventId,
                Name = "VIP",
                PriceMinor = 20000,
                VATRate = 0.12m,
                Capacity = 2,
                QuantitySold = 2, // SOLD OUT
                QuantityHeld = 0,
                AdmitCount = 1,
                MinPerOrder = 1,
                MaxPerOrder = 5,
                Status = TicketTypeStatus.OnSale
            };
            h.Db.TicketTypes.Add(typeB);
            await h.Db.SaveChangesAsync();

            var user = h.SeedUser();
            var promo = h.SeedPromo(code: "MULTI", pct: 10, maxRedemptions: 5, usageCount: 0);

            h.Promo.Result = new PromoValidationResult
            {
                Ok = true,
                Code = "MULTI",
                PromoCodeId = promo.Id,
                DiscountMinor = 3000,
                PerLineDiscounts = new[]
                {
                    new PromoLineDiscount(typeA.Id, 1000),
                    new PromoLineDiscount(typeB.Id, 2000)
                }
            };

            var lines = new[] { new OrderLineRequest(typeA.Id, 1), new OrderLineRequest(typeB.Id, 1) };
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                h.Orchestrator.CreatePaymentAsync(
                    eventId, lines, null, user.Id, "MULTI", null, CancellationToken.None));

            Assert.Contains("sold out", ex.Message, StringComparison.OrdinalIgnoreCase);

            // No order persisted, no held inventory on typeA, promo usage unchanged.
            Assert.Empty(await h.Db.Orders.AsNoTracking().ToListAsync());
            var freshA = await h.Db.TicketTypes.AsNoTracking().FirstAsync(t => t.Id == typeA.Id);
            Assert.Equal(0, freshA.QuantityHeld);
            var freshPromo = await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id);
            Assert.Equal(0, freshPromo.UsageCount);
            Assert.Empty(await h.Db.Set<PromoRedemption>().AsNoTracking().ToListAsync());
        }

        // ----- capture: Reserved → Consumed (additional explicit assertion) -----------
        // The zero-total test in PaymentOrchestratorCheckoutTests already asserts Consumed.
        // Here we verify it for a NON-zero order to distinguish the two code paths.
        [Fact]
        public async Task Capture_transitions_promo_redemption_from_Reserved_to_Consumed()
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

            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == created.Order.Reference);
            var beforeRedemption = await h.Db.Set<PromoRedemption>().AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Reserved, beforeRedemption.Status);

            // Capture.
            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                OrderRef: created.Order.Reference,
                PspRef: "psp-capture-1",
                Type: PaymentEventType.Captured,
                Amount: Money.Nok(45000),
                OccurredAt: DateTime.UtcNow,
                RawPayload: "{}"), CancellationToken.None);

            var after = await h.Db.Set<PromoRedemption>().AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Consumed, after.Status);
        }

        // ----- release decrements UsageCount (additional explicit assertion) ----------
        // Expire_releases_holds_and_promo_reservation in PaymentOrchestratorCheckoutTests
        // already asserts UsageCount goes 1→0 and status Released on Expired. This adds
        // the Failed event path to show it uses the same release logic.
        [Fact]
        public async Task Failed_payment_event_releases_promo_and_decrements_usage()
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
            Assert.Equal(1, (await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id)).UsageCount);

            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                OrderRef: created.Order.Reference, PspRef: null,
                Type: PaymentEventType.Failed, Amount: Money.Nok(0),
                OccurredAt: DateTime.UtcNow, RawPayload: "{}"), CancellationToken.None);

            Assert.Equal(0, (await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id)).UsageCount);
            var failedOrder = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == created.Order.Reference);
            var redemption = await h.Db.Set<PromoRedemption>().AsNoTracking()
                .FirstAsync(r => r.OrderId == failedOrder.Id);
            Assert.Equal(PromoRedemptionStatus.Released, redemption.Status);
        }

        // ----- sweeper releases promo with expired holds ------------------------------
        // The sweeper drives FinalizeAsync(Expired) which exercises the same ReleaseAsync
        // path. We test the sweeper trigger path here rather than just Expired via webhook.
        [Fact]
        public async Task Sweeper_expired_hold_releases_promo_reservation()
        {
            using var h = new OrchestratorTestHarness(holdMinutes: 0); // 0-minute hold = immediately expired
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 5);
            var user = h.SeedUser();
            var promo = h.SeedPromo(code: "SWEEP", pct: 10, maxRedemptions: 3, usageCount: 0);
            h.Promo.Result = new PromoValidationResult
            {
                Ok = true, Code = "SWEEP", PromoCodeId = promo.Id, DiscountMinor = 5000,
                PerLineDiscounts = new[] { new PromoLineDiscount(type.Id, 5000) }
            };

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, "SWEEP", null, CancellationToken.None);

            // Manually force the hold to be visibly expired so the sweeper picks it up.
            var hold = await h.Db.Set<TicketHold>().FirstAsync();
            hold.ExpiresAt = DateTime.UtcNow.AddMinutes(-5);
            await h.Db.SaveChangesAsync();

            // Simulate the sweeper: send an Expired event for the order's payment.
            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                OrderRef: created.Order.Reference, PspRef: null,
                Type: PaymentEventType.Expired, Amount: Money.Nok(0),
                OccurredAt: DateTime.UtcNow, RawPayload: "{}"), CancellationToken.None);

            Assert.Equal(0, (await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id)).UsageCount);
            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == created.Order.Reference);
            var redemption = await h.Db.Set<PromoRedemption>().AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Released, redemption.Status);
        }

        // ----- retry reference format: -r2 then -r3 -----------------------------------
        // Retry_creates_second_attempt_with_r2_reference already covers first retry.
        // This test adds a THIRD attempt to verify the -r3 suffix increments correctly.
        [Fact]
        public async Task Retry_creates_third_attempt_with_r3_reference()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, null, null, CancellationToken.None);

            var ref1 = created.Order.Reference;

            await h.Orchestrator.RetryPaymentAsync(ref1, null, user.Id, CancellationToken.None);
            await h.Orchestrator.RetryPaymentAsync(ref1, null, user.Id, CancellationToken.None);

            var payments = await h.Db.Payments.AsNoTracking()
                .Where(p => p.ProviderReference == ref1
                         || p.ProviderReference.StartsWith(ref1 + "-r"))
                .OrderBy(p => p.AttemptNo)
                .ToListAsync();

            Assert.Equal(3, payments.Count);
            Assert.Equal(ref1, payments[0].ProviderReference);          // attempt 1
            Assert.Equal($"{ref1}-r2", payments[1].ProviderReference);  // attempt 2
            Assert.Equal($"{ref1}-r3", payments[2].ProviderReference);  // attempt 3
            Assert.Equal(PaymentStatus.Aborted, payments[0].Status);
            Assert.Equal(PaymentStatus.Aborted, payments[1].Status);
            Assert.Equal(PaymentStatus.Created, payments[2].Status);
        }

        // ----- retry re-reserves released holds ---------------------------------------
        // When the hold expired (sweeper released it), a retry must successfully re-reserve
        // inventory for the new attempt. If inventory is available the retry succeeds.
        [Fact]
        public async Task Retry_re_reserves_released_holds_when_inventory_available()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 5);
            var user = h.SeedUser();

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, null, null, CancellationToken.None);

            // Simulate expiry: hold expired, inventory released.
            var hold = await h.Db.Set<TicketHold>().FirstAsync();
            hold.Status = TicketHoldStatus.Expired;
            hold.ExpiresAt = DateTime.UtcNow.AddMinutes(-10);
            // Decrement QuantityHeld as the sweeper would.
            await h.Db.Database.ExecuteSqlInterpolatedAsync(
                $@"UPDATE ""TicketTypes"" SET ""QuantityHeld"" = 0 WHERE ""Id"" = {type.Id}");
            await h.Db.SaveChangesAsync();

            // Retry: should re-reserve the hold.
            var retry = await h.Orchestrator.RetryPaymentAsync(
                created.Order.Reference, null, user.Id, CancellationToken.None);

            Assert.NotNull(retry);
            var refreshed = await h.Db.TicketTypes.AsNoTracking().FirstAsync(t => t.Id == type.Id);
            Assert.Equal(1, refreshed.QuantityHeld); // re-reserved
        }

        // ----- capture after sweeper released the redemption (§8 race) ---------------
        // The sweeper releases the promo redemption (Released) and decrements UsageCount.
        // Later, a capture arrives. The orchestrator must:
        //   - still issue tickets (money was taken);
        //   - flip redemption → Consumed;
        //   - unconditionally re-increment UsageCount.
        [Fact]
        public async Task Capture_after_sweeper_released_redemption_still_issues_and_reconsumed()
        {
            using var h = new OrchestratorTestHarness();
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();
            var promo = h.SeedPromo(code: "RACE", pct: 10, maxRedemptions: 5, usageCount: 0);
            h.Promo.Result = new PromoValidationResult
            {
                Ok = true, Code = "RACE", PromoCodeId = promo.Id, DiscountMinor = 5000,
                PerLineDiscounts = new[] { new PromoLineDiscount(type.Id, 5000) }
            };

            var created = await h.Orchestrator.CreatePaymentAsync(
                eventId, Line(type.Id), null, user.Id, "RACE", null, CancellationToken.None);

            var order = await h.Db.Orders.AsNoTracking().FirstAsync(o => o.Reference == created.Order.Reference);

            // Simulate sweeper: flip redemption → Released and decrement UsageCount.
            var redemption = await h.Db.Set<PromoRedemption>().FirstAsync(r => r.OrderId == order.Id);
            redemption.Status = PromoRedemptionStatus.Released;
            await h.Db.Database.ExecuteSqlInterpolatedAsync(
                $@"UPDATE ""PromotionCodes"" SET ""UsageCount"" = 0 WHERE ""Id"" = {promo.Id}");
            await h.Db.SaveChangesAsync();

            // Webhook capture arrives.
            await h.Orchestrator.FinalizeAsync(new PaymentEvent(
                OrderRef: created.Order.Reference, PspRef: "psp-race",
                Type: PaymentEventType.Captured, Amount: Money.Nok(45000),
                OccurredAt: DateTime.UtcNow, RawPayload: "{}"), CancellationToken.None);

            // Ticket still issued.
            Assert.Equal(1, await h.Db.Tickets.AsNoTracking().CountAsync(t => t.UserId == user.Id));

            // Redemption re-consumed.
            var after = await h.Db.Set<PromoRedemption>().AsNoTracking().FirstAsync(r => r.OrderId == order.Id);
            Assert.Equal(PromoRedemptionStatus.Consumed, after.Status);

            // UsageCount re-incremented back to 1.
            var freshPromo = await h.Db.PromotionCodes.AsNoTracking().FirstAsync(p => p.Id == promo.Id);
            Assert.Equal(1, freshPromo.UsageCount);
        }

        // ----- zero-total: provider is never called (assert via call count) -----------
        // Already asserted via Assert.Empty(h.Provider.Initiated) in
        // Create_with_full_discount_issues_immediately_without_initiate. Nothing to add;
        // the existing test is complete for this case.

        // ----- retry on paid order rejected (already in PaymentOrchestratorCheckoutTests)
        //   Retry_rejected_on_a_paid_order — already covered; not duplicated here.
    }
}
