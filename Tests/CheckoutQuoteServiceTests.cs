using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Xunit;

namespace DJDiP.Tests
{
    // CheckoutQuoteService smoke set (checkout-orchestration C2). Locks the new C2 rule:
    // a hidden tier is rejected with the same "not found" message as an unknown type
    // UNLESS the promo unlocks it — plus the no-promo happy path and VAT-on-gross totals.
    public class CheckoutQuoteServiceTests
    {
        private static readonly Guid EventA = Guid.NewGuid();

        // Stub promo service: returns a fixed result so the quote's unlock/discount
        // wiring is exercised without the real PromoCodeService/DB.
        private sealed class StubPromo : IPromoCodeService
        {
            private readonly PromoValidationResult _result;
            public StubPromo(PromoValidationResult result) => _result = result;
            public Task<PromoValidationResult> ValidateAsync(
                string code, Guid eventId, IReadOnlyList<PromoLine> lines, string? userId, CancellationToken ct)
                => Task.FromResult(_result);
        }

        private static TicketType Type(Guid id, bool hidden = false, long price = 10000,
            TicketTypeStatus status = TicketTypeStatus.OnSale, int capacity = 100, int sold = 0, int held = 0)
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
                MinPerOrder = 1,
                MaxPerOrder = 10,
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

        [Fact]
        public async Task No_promo_prices_with_vat_on_gross()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, price: 10000) });
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 2) }, PromoCode: null);

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.True(q.Ok);
            Assert.Null(q.Promo);                       // no promo supplied
            Assert.Equal(20000, q.TotalMinor);          // 2 * 10000, no discount
            Assert.Equal(0, q.DiscountMinor);
            // VAT-inclusive: net = round(20000 / 1.12) = 17857; vat = 2143.
            Assert.Equal(17857, q.SubtotalMinor);
            Assert.Equal(2143, q.VatMinor);
            Assert.Equal(q.SubtotalMinor + q.VatMinor, q.TotalMinor);
            Assert.Equal(new[] { "Vipps", "Stripe" }, q.AvailableProviders);
        }

        [Fact]
        public async Task Hidden_type_without_unlock_is_rejected_as_not_found()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(new[] { Type(hiddenId, hidden: true) }); // no promo
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(hiddenId, 1) }, PromoCode: null);

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.False(q.Ok);
            Assert.Equal("One or more ticket types were not found for this event.", q.Reason);
        }

        [Fact]
        public async Task Hidden_type_with_unlocking_promo_is_quotable()
        {
            var hiddenId = Guid.NewGuid();
            var unlockingPromo = new StubPromo(new PromoValidationResult
            {
                Ok = true,
                Code = "VIP",
                PromoCodeId = Guid.NewGuid(),
                DiscountMinor = 0,
                PerLineDiscounts = Array.Empty<PromoLineDiscount>(),
                UnlockedTicketTypeIds = new[] { hiddenId }
            });
            var svc = Service(new[] { Type(hiddenId, hidden: true, price: 10000) }, unlockingPromo);
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(hiddenId, 1) }, PromoCode: "VIP");

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.True(q.Ok);
            Assert.NotNull(q.Promo);
            Assert.True(q.Promo!.Ok);
            Assert.Equal(10000, q.TotalMinor);
        }

        [Fact]
        public async Task Invalid_promo_does_not_fail_quote_and_drops_discount()
        {
            var typeId = Guid.NewGuid();
            var badPromo = new StubPromo(PromoValidationResult.Fail("EXPIRED", "This code has expired."));
            var svc = Service(new[] { Type(typeId, price: 10000) }, badPromo);
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 1) }, PromoCode: "EXPIRED");

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.True(q.Ok);                          // selection is fine
            Assert.NotNull(q.Promo);
            Assert.False(q.Promo!.Ok);
            Assert.Equal("This code has expired.", q.Promo.Reason);
            Assert.Equal(0, q.DiscountMinor);           // no discount applied
            Assert.Equal(10000, q.TotalMinor);
        }

        [Fact]
        public async Task Sold_out_line_fails_quote()
        {
            var typeId = Guid.NewGuid();
            var svc = Service(new[] { Type(typeId, capacity: 5, sold: 5) }); // available 0
            var selection = new CheckoutSelection(EventA,
                new[] { new CheckoutSelectionLine(typeId, 1) }, PromoCode: null);

            var q = await svc.QuoteAsync(selection, "user-1", CancellationToken.None);

            Assert.False(q.Ok);
            Assert.Contains("sold out", q.Reason);
        }
    }
}
