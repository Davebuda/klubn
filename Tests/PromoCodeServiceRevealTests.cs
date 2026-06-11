using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Xunit;

namespace DJDiP.Tests
{
    // Hidden-tier reveal (checkout-orchestration design §3.2). Locks the contract of
    // PromoCodeService.ResolveHiddenUnlockAsync — a PURE READ used by the public ticketTypes
    // query to surface a hidden tier the buyer can't otherwise see:
    //   - valid UnlocksHiddenTypes code in scope            -> reveals the hidden tier(s)
    //   - unknown / inactive / expired / not-an-unlock code -> reveals NOTHING (empty)
    //   - out-of-scope event / type-list / usage-exhausted  -> reveals NOTHING (empty)
    // Every failure returns the SAME empty list (anti-oracle: a real-but-irrelevant code is
    // indistinguishable from a bogus one). The reveal NEVER reserves/redeems.
    public class PromoCodeServiceRevealTests
    {
        private static readonly Guid EventA = Guid.NewGuid();
        private static readonly Guid EventB = Guid.NewGuid();

        private static TicketType Hidden(Guid id, TicketTypeStatus status = TicketTypeStatus.OnSale,
            Guid? eventId = null)
            => new()
            {
                Id = id,
                EventId = eventId ?? EventA,
                Name = "Secret",
                PriceMinor = 30000,
                VATRate = 0.12m,
                Currency = "NOK",
                Capacity = 10,
                Status = status,
                IsHidden = true
            };

        private static PromotionCode Promo(string code, bool unlocks = true, bool active = true,
            Guid? eventId = null, DateTime? validFrom = null, DateTime? validUntil = null,
            int? maxRedemptions = null, int usageCount = 0, IEnumerable<Guid>? typeIds = null)
            => new()
            {
                Id = Guid.NewGuid(),
                Code = code.ToUpperInvariant(),
                Kind = PromoKind.Percent,
                DiscountPercentage = 10,
                IsActive = active,
                UnlocksHiddenTypes = unlocks,
                EventId = eventId,
                ValidFrom = validFrom,
                ValidUntil = validUntil ?? DateTime.UtcNow.AddYears(1),
                MaxRedemptions = maxRedemptions,
                UsageCount = usageCount,
                TicketTypes = (typeIds ?? Array.Empty<Guid>())
                    .Select(t => new PromoCodeTicketType { TicketTypeId = t }).ToList()
            };

        private static PromoCodeService Service(PromotionCode? promo, IEnumerable<TicketType> types)
        {
            var uow = new FakeUnitOfWork(
                promos: new FakePromoCodeRepository(promo),
                ticketTypes: new FakeTicketTypeRepository(types));
            return new PromoCodeService(uow);
        }

        [Fact]
        public async Task Valid_unlock_code_reveals_hidden_tier()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("VIP", typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("vip", EventA, CancellationToken.None);

            Assert.Single(revealed);
            Assert.Equal(hiddenId, revealed[0].Id);
        }

        [Fact]
        public async Task Wildcard_unlock_code_reveals_all_hidden_onsale_tiers()
        {
            var h1 = Guid.NewGuid();
            var h2 = Guid.NewGuid();
            // Empty type list + UnlocksHiddenTypes = wildcard (all hidden OnSale tiers).
            var svc = Service(Promo("ALL"), new[] { Hidden(h1), Hidden(h2) });

            var revealed = await svc.ResolveHiddenUnlockAsync("ALL", EventA, CancellationToken.None);

            Assert.Equal(2, revealed.Count);
        }

        [Fact]
        public async Task Unknown_code_reveals_nothing()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(promo: null, types: new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("NOPE", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Code_without_unlock_flag_reveals_nothing()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("DISCOUNT", unlocks: false, typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("DISCOUNT", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Out_of_scope_event_reveals_nothing()
        {
            // Code scoped to EventB; the hidden tier lives on EventA. Asking for EventA reveals
            // nothing (the event-scope gate rejects), and the tier is on a different event anyway.
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("VIP", eventId: EventB, typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("VIP", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Expired_window_reveals_nothing()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("VIP", validUntil: DateTime.UtcNow.AddDays(-1), typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("VIP", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Inactive_code_reveals_nothing()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("VIP", active: false, typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("VIP", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Usage_exhausted_code_reveals_nothing()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("VIP", maxRedemptions: 5, usageCount: 5, typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("VIP", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Empty_code_reveals_nothing()
        {
            var hiddenId = Guid.NewGuid();
            var svc = Service(Promo("VIP", typeIds: new[] { hiddenId }), new[] { Hidden(hiddenId) });

            var revealed = await svc.ResolveHiddenUnlockAsync("  ", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }

        [Fact]
        public async Task Draft_hidden_tier_is_not_revealed()
        {
            // A hidden tier still in Draft is not yet sellable — reveal only surfaces OnSale.
            var hiddenId = Guid.NewGuid();
            var svc = Service(
                Promo("VIP", typeIds: new[] { hiddenId }),
                new[] { Hidden(hiddenId, status: TicketTypeStatus.Draft) });

            var revealed = await svc.ResolveHiddenUnlockAsync("VIP", EventA, CancellationToken.None);

            Assert.Empty(revealed);
        }
    }
}
