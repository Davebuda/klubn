using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using DJDiP.Domain.Models.AdmnModels;

namespace DJDiP.Tests
{
    // P0-WS3C (GDPR) hand-rolled fakes — same philosophy as AuthzFakes/CheckoutFakes: implement
    // only the members the code under test touches; throw NotSupportedException elsewhere so an
    // accidental dependency surfaces loudly. No mocking lib in the Tests project.

    // User repo that answers GetByEmailAsync + GetByIdAsync from a seeded set and records
    // AddAsync. Mutations happen in-place (UpdateAsync stores back). Used by AuthService
    // (register) and UserService (anonymize/export) tests.
    internal sealed class GdprUserRepository : IUserRepository
    {
        private readonly Dictionary<string, ApplicationUser> _byId;
        public List<ApplicationUser> Added { get; } = new();
        public int AddCount { get; private set; }

        public GdprUserRepository(params ApplicationUser[] users)
            => _byId = users.ToDictionary(u => u.Id);

        public Task<ApplicationUser?> GetByIdAsync(object id)
            => Task.FromResult(_byId.TryGetValue((string)id, out var u) ? u : null);

        public Task<ApplicationUser?> GetByEmailAsync(string email)
            => Task.FromResult(_byId.Values.FirstOrDefault(
                u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));

        public Task<ApplicationUser> AddAsync(ApplicationUser entity)
        {
            AddCount++;
            Added.Add(entity);
            _byId[entity.Id] = entity;
            return Task.FromResult(entity);
        }

        public Task UpdateAsync(ApplicationUser entity)
        {
            _byId[entity.Id] = entity;
            return Task.CompletedTask;
        }

        // Unused surface.
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<IEnumerable<ApplicationUser>> GetUsersByProviderAsync(string provider) => throw new NotSupportedException();
        public Task<bool> EmailExistsAsync(string email) => throw new NotSupportedException();
        public Task<IEnumerable<ApplicationUser>> GetAllAsync() => throw new NotSupportedException();
        public Task DeleteAsync(ApplicationUser entity) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // Ticket repo returning a fixed user-scoped set for the export path. Tracks whether any
    // mutating/deleting surface was hit so the erasure test can prove financial rows are untouched.
    internal sealed class GdprTicketRepository : ITicketRepository
    {
        private readonly List<Ticket> _all;
        public bool MutatedOrDeleted { get; private set; }

        public GdprTicketRepository(params Ticket[] tickets) => _all = tickets.ToList();

        public Task<IEnumerable<Ticket>> GetTicketsByUserIdAsync(string userId)
            => Task.FromResult<IEnumerable<Ticket>>(_all.Where(t => t.UserId == userId).ToList());

        public IReadOnlyList<Ticket> All => _all;

        public Task DeleteAsync(Ticket entity) { MutatedOrDeleted = true; return Task.CompletedTask; }
        public Task UpdateAsync(Ticket entity) { MutatedOrDeleted = true; return Task.CompletedTask; }

        // Unused surface.
        public Task<Ticket?> GetByIdAsync(object id) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetTicketsByEventIdAsync(Guid eventId) => throw new NotSupportedException();
        public Task<Ticket?> GetByTicketNumberAsync(string ticketNumber) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetValidTicketsAsync() => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetTicketsByDateRangeAsync(DateTime startDate, DateTime endDate) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetTicketsByOrderAsync(Guid orderId, CancellationToken ct) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetAllAsync() => throw new NotSupportedException();
        public Task<Ticket> AddAsync(Ticket entity) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // Order repo returning a fixed user-scoped set for the export path; tracks mutation/deletion.
    internal sealed class GdprOrderRepository : IOrderRepository
    {
        private readonly List<Order> _all;
        public bool MutatedOrDeleted { get; private set; }

        public GdprOrderRepository(params Order[] orders) => _all = orders.ToList();

        public Task<IEnumerable<Order>> GetOrdersByUserIdAsync(string userId)
            => Task.FromResult<IEnumerable<Order>>(_all.Where(o => o.UserId == userId).ToList());

        public IReadOnlyList<Order> All => _all;

        public Task DeleteAsync(Order entity) { MutatedOrDeleted = true; return Task.CompletedTask; }
        public Task UpdateAsync(Order entity) { MutatedOrDeleted = true; return Task.CompletedTask; }

        // Unused surface.
        public Task<IEnumerable<Order>> GetOrdersByStatusAsync(OrderStatus status) => throw new NotSupportedException();
        public Task<IEnumerable<Order>> GetOrdersByDateRangeAsync(DateTime startDate, DateTime endDate) => throw new NotSupportedException();
        public Task<Order?> GetOrderWithItemsAsync(Guid orderId) => throw new NotSupportedException();
        public Task<IEnumerable<Order>> GetOrdersWithPaymentAsync() => throw new NotSupportedException();
        public Task<Order?> GetOrderForConfirmationAsync(Guid orderId, CancellationToken ct) => throw new NotSupportedException();
        public Task<Order?> GetByIdAsync(object id) => throw new NotSupportedException();
        public Task<IEnumerable<Order>> GetAllAsync() => throw new NotSupportedException();
        public Task<Order> AddAsync(Order entity) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // No-op login throttle for AuthService construction (register path never touches it).
    internal sealed class NoopLoginThrottle : ILoginThrottle
    {
        public bool IsLocked(string email) => false;
        public void RegisterFailure(string email) { }
        public void Reset(string email) { }
    }

    // UoW exposing Users / Tickets / Orders / AuditLogs — the surface WS3C UserService needs.
    internal sealed class GdprUnitOfWork : IUnitOfWork
    {
        public GdprUnitOfWork(
            IUserRepository? users = null,
            ITicketRepository? tickets = null,
            IOrderRepository? orders = null,
            IAuditLogRepository? audit = null)
        {
            _users = users!;
            _tickets = tickets!;
            _orders = orders!;
            _audit = audit!;
        }

        private readonly IUserRepository _users;
        private readonly ITicketRepository _tickets;
        private readonly IOrderRepository _orders;
        private readonly IAuditLogRepository _audit;
        public int SaveChangesCount { get; private set; }

        public IUserRepository Users => _users;
        public ITicketRepository Tickets => _tickets;
        public IOrderRepository Orders => _orders;
        public IAuditLogRepository AuditLogs => _audit;

        public Task<int> SaveChangesAsync()
        {
            SaveChangesCount++;
            return Task.FromResult(0);
        }

        // Out of scope.
        public IEventRepository Events => throw new NotSupportedException();
        public IPaymentRepository Payments => throw new NotSupportedException();
        public IDJProfileRepository DJProfiles => throw new NotSupportedException();
        public IPromoCodeRepository PromotionCodes => throw new NotSupportedException();
        public ITicketTypeRepository TicketTypes => throw new NotSupportedException();
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

        public Task BeginTransactionAsync() => throw new NotSupportedException();
        public Task CommitTransactionAsync() => throw new NotSupportedException();
        public Task RollbackTransactionAsync() => throw new NotSupportedException();
        public void Dispose() { }
    }
}
