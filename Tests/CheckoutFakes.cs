using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Tests
{
    // Minimal hand-rolled fakes for the C2 service smoke tests (no mocking lib in the
    // Tests project). They implement only the members the services-under-test touch and
    // throw NotSupportedException everywhere else, so an accidental dependency surfaces
    // loudly instead of silently passing.

    internal sealed class FakePromoCodeRepository : IPromoCodeRepository
    {
        private readonly PromotionCode? _promo;
        private readonly int _userRedemptions;

        public FakePromoCodeRepository(PromotionCode? promo, int userRedemptions = 0)
        {
            _promo = promo;
            _userRedemptions = userRedemptions;
        }

        public Task<PromotionCode?> GetByCodeWithTypesAsync(string code, CancellationToken ct)
        {
            // Mirror the real repo's case-insensitive match on the normalized code.
            if (_promo is not null &&
                string.Equals(_promo.Code, (code ?? string.Empty).ToUpperInvariant(), StringComparison.Ordinal))
                return Task.FromResult<PromotionCode?>(_promo);
            return Task.FromResult<PromotionCode?>(null);
        }

        public Task<int> CountActiveRedemptionsForUserAsync(Guid promoCodeId, string userId, CancellationToken ct)
            => Task.FromResult(_userRedemptions);

        // Unused IRepository surface.
        public Task<PromotionCode?> GetByIdAsync(object id) => throw new NotSupportedException();
        public Task<IEnumerable<PromotionCode>> GetAllAsync() => throw new NotSupportedException();
        public Task<PromotionCode> AddAsync(PromotionCode entity) => throw new NotSupportedException();
        public Task UpdateAsync(PromotionCode entity) => throw new NotSupportedException();
        public Task DeleteAsync(PromotionCode entity) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    internal sealed class FakeTicketTypeRepository : ITicketTypeRepository
    {
        private readonly IReadOnlyDictionary<Guid, TicketType> _byId;

        public FakeTicketTypeRepository(IEnumerable<TicketType> types)
            => _byId = types.ToDictionary(t => t.Id);

        public Task<IReadOnlyDictionary<Guid, TicketType>> GetByEventAndIdsAsync(
            Guid eventId, IReadOnlyList<Guid> typeIds, CancellationToken ct)
        {
            IReadOnlyDictionary<Guid, TicketType> result = _byId
                .Where(kv => kv.Value.EventId == eventId && typeIds.Contains(kv.Key))
                .ToDictionary(kv => kv.Key, kv => kv.Value);
            return Task.FromResult(result);
        }

        public Task<IReadOnlyList<TicketType>> GetHiddenOnSaleByEventAsync(
            Guid eventId, IReadOnlyCollection<Guid>? restrictToTypeIds, CancellationToken ct)
        {
            IReadOnlyList<TicketType> result = _byId.Values
                .Where(t => t.EventId == eventId && t.IsHidden && t.Status == TicketTypeStatus.OnSale)
                .Where(t => restrictToTypeIds is not { Count: > 0 } || restrictToTypeIds.Contains(t.Id))
                .OrderBy(t => t.SortOrder)
                .ToList();
            return Task.FromResult(result);
        }

        // Unused IRepository surface.
        public Task<TicketType?> GetByIdAsync(object id) => throw new NotSupportedException();
        public Task<IEnumerable<TicketType>> GetAllAsync() => throw new NotSupportedException();
        public Task<TicketType> AddAsync(TicketType entity) => throw new NotSupportedException();
        public Task UpdateAsync(TicketType entity) => throw new NotSupportedException();
        public Task DeleteAsync(TicketType entity) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // Fake UnitOfWork exposing ONLY the two repos the C2 services use.
    internal sealed class FakeUnitOfWork : IUnitOfWork
    {
        public FakeUnitOfWork(IPromoCodeRepository? promos = null, ITicketTypeRepository? ticketTypes = null)
        {
            _promos = promos!;
            _ticketTypes = ticketTypes!;
        }

        private readonly IPromoCodeRepository _promos;
        private readonly ITicketTypeRepository _ticketTypes;

        public IPromoCodeRepository PromotionCodes => _promos;
        public ITicketTypeRepository TicketTypes => _ticketTypes;

        // Everything else is out of scope for these tests.
        public IUserRepository Users => throw new NotSupportedException();
        public IEventRepository Events => throw new NotSupportedException();
        public ITicketRepository Tickets => throw new NotSupportedException();
        public IOrderRepository Orders => throw new NotSupportedException();
        public IPaymentRepository Payments => throw new NotSupportedException();
        public IDJProfileRepository DJProfiles => throw new NotSupportedException();
        public IRepository<Genre> Genres => throw new NotSupportedException();
        public IRepository<Venue> Venues => throw new NotSupportedException();
        public IRepository<Song> Songs => throw new NotSupportedException();
        public IRepository<Newsletter> Newsletters => throw new NotSupportedException();
        public IRepository<Notification> Notifications => throw new NotSupportedException();
        public IRepository<ContactMessage> ContactMessages => throw new NotSupportedException();
        public IRepository<OrderItem> OrderItems => throw new NotSupportedException();
        public IRepository<DJTop10> DJTop10s => throw new NotSupportedException();
        public IRepository<EventDJ> EventDJs => throw new NotSupportedException();
        public IUserFollowDJRepository UserFollowDJs => throw new NotSupportedException();
        public IRepository<SiteSetting> SiteSettings => throw new NotSupportedException();
        public IRepository<GalleryMedia> GalleryMedia => throw new NotSupportedException();
        public IRepository<EventHighlight> EventHighlights => throw new NotSupportedException();
        public IRepository<DJReview> DJReviews => throw new NotSupportedException();
        public IDJApplicationRepository DJApplications => throw new NotSupportedException();
        public IRepository<Playlist> Playlists => throw new NotSupportedException();
        public IRepository<PlaylistSong> PlaylistSongs => throw new NotSupportedException();
        public IRepository<DJMix> DJMixes => throw new NotSupportedException();

        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
        public Task BeginTransactionAsync() => throw new NotSupportedException();
        public Task CommitTransactionAsync() => throw new NotSupportedException();
        public Task RollbackTransactionAsync() => throw new NotSupportedException();
        public void Dispose() { }
    }

    internal sealed class FakeProviderCatalog : IPaymentProviderCatalog
    {
        public IReadOnlyList<string> EnabledProviders { get; }
        public string DefaultProvider { get; }

        public FakeProviderCatalog(params string[] providers)
        {
            EnabledProviders = providers.Length == 0 ? new[] { "Sandbox" } : providers;
            DefaultProvider = EnabledProviders[0];
        }
    }
}
