using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Xunit;

namespace DJDiP.Tests
{
    // PromoCodeService validation smoke set (checkout-orchestration C2). Full matrix is
    // C6; these lock the server-side rules that must never regress: expired window,
    // event scope, and that a valid percent code computes a discount.
    public class PromoCodeServiceTests
    {
        private static readonly Guid EventA = Guid.NewGuid();
        private static readonly Guid TypeA = Guid.NewGuid();

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

        private static IReadOnlyList<PromoLine> OneLine(long unitPrice = 10000, int qty = 2)
            => new[] { new PromoLine(TypeA, qty, unitPrice, 0.12m, IsHidden: false) };

        [Fact]
        public async Task Valid_percent_code_computes_discount()
        {
            var svc = Service(ValidPercent(10m));
            var r = await svc.ValidateAsync("save10", EventA, OneLine(10000, 2), "user-1", CancellationToken.None);

            Assert.True(r.Ok);
            Assert.Null(r.Reason);
            Assert.Equal("SAVE10", r.Code);            // normalized to uppercase
            Assert.Equal(2000, r.DiscountMinor);       // 10% of 20000
            Assert.Equal(2000, r.PerLineDiscounts.Sum(p => p.DiscountMinor));
        }

        [Fact]
        public async Task Expired_code_fails_with_reason()
        {
            var promo = ValidPercent();
            promo.ValidUntil = DateTime.UtcNow.AddDays(-1); // window closed
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code has expired.", r.Reason);
            Assert.Equal(0, r.DiscountMinor);
        }

        [Fact]
        public async Task Wrong_event_fails()
        {
            var promo = ValidPercent(eventId: Guid.NewGuid()); // scoped to a DIFFERENT event
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code doesn't apply to this event.", r.Reason);
        }

        [Fact]
        public async Task Per_user_limit_without_user_prompts_sign_in()
        {
            var promo = ValidPercent();
            promo.MaxRedemptionsPerUser = 1;
            var svc = Service(promo);

            var r = await svc.ValidateAsync("SAVE10", EventA, OneLine(), userId: null, CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("Sign in to use this code.", r.Reason);
        }

        [Fact]
        public async Task Unknown_code_fails()
        {
            var svc = Service(ValidPercent());
            var r = await svc.ValidateAsync("NOPE", EventA, OneLine(), "user-1", CancellationToken.None);

            Assert.False(r.Ok);
            Assert.Equal("This code isn't valid.", r.Reason);
        }
    }
}
