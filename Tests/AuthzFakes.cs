using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using DJDiP.Domain.Models.AdmnModels;

namespace DJDiP.Tests
{
    // P0-WS1 (authz) hand-rolled fakes. Same philosophy as CheckoutFakes: implement only
    // the members the code under test actually touches; throw NotSupportedException
    // everywhere else so an accidental dependency surfaces loudly. No mocking lib in the
    // Tests project.

    // In-memory ticket repo backed by a dictionary. Tracks UpdateAsync calls so a test can
    // assert "no mutation happened" on a denied ownership attempt.
    internal sealed class FakeTicketRepository : ITicketRepository
    {
        private readonly Dictionary<Guid, Ticket> _byId;
        public int UpdateCount { get; private set; }

        public FakeTicketRepository(params Ticket[] tickets)
            => _byId = tickets.ToDictionary(t => t.Id);

        public Task<Ticket?> GetByIdAsync(object id)
            => Task.FromResult(_byId.TryGetValue((Guid)id, out var t) ? t : null);

        public Task UpdateAsync(Ticket entity)
        {
            UpdateCount++;
            _byId[entity.Id] = entity;
            return Task.CompletedTask;
        }

        // Unused surface.
        public Task<IEnumerable<Ticket>> GetTicketsByUserIdAsync(string userId) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetTicketsByEventIdAsync(Guid eventId) => throw new NotSupportedException();
        public Task<Ticket?> GetByTicketNumberAsync(string ticketNumber) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetValidTicketsAsync() => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetTicketsByDateRangeAsync(DateTime startDate, DateTime endDate) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetTicketsByOrderAsync(Guid orderId, CancellationToken ct) => throw new NotSupportedException();
        public Task<IEnumerable<Ticket>> GetAllAsync() => throw new NotSupportedException();
        public Task<Ticket> AddAsync(Ticket entity) => throw new NotSupportedException();
        public Task DeleteAsync(Ticket entity) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // In-memory user repo. Records AddAsync so the FollowService placeholder-removal test can
    // assert no auto-created user. ExistsAsync answers from the seeded set.
    internal sealed class FakeUserRepository : IUserRepository
    {
        private readonly Dictionary<string, ApplicationUser> _byId;
        public int AddCount { get; private set; }
        public List<ApplicationUser> Added { get; } = new();

        public FakeUserRepository(params ApplicationUser[] users)
            => _byId = users.ToDictionary(u => u.Id);

        public Task<ApplicationUser?> GetByIdAsync(object id)
            => Task.FromResult(_byId.TryGetValue((string)id, out var u) ? u : null);

        public Task<bool> ExistsAsync(object id)
            => Task.FromResult(_byId.ContainsKey((string)id));

        public Task<ApplicationUser> AddAsync(ApplicationUser entity)
        {
            AddCount++;
            Added.Add(entity);
            _byId[entity.Id] = entity;
            return Task.FromResult(entity);
        }

        // WS2: ChangeRoleAsync calls UpdateAsync — a no-op here (mutation happens in-place on
        // the seeded entity; SaveChanges is the AuthzUnitOfWork no-op).
        public Task UpdateAsync(ApplicationUser entity)
        {
            _byId[entity.Id] = entity;
            return Task.CompletedTask;
        }

        // Unused surface.
        public Task<ApplicationUser?> GetByEmailAsync(string email) => throw new NotSupportedException();
        public Task<IEnumerable<ApplicationUser>> GetUsersByProviderAsync(string provider) => throw new NotSupportedException();
        public Task<bool> EmailExistsAsync(string email) => throw new NotSupportedException();
        public Task<IEnumerable<ApplicationUser>> GetAllAsync() => throw new NotSupportedException();
        public Task DeleteAsync(ApplicationUser entity) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // In-memory follow repo. Records AddAsync so the placeholder-removal test can assert a
    // follow row IS created keyed to the JWT caller while NO placeholder user is minted.
    internal sealed class FakeUserFollowDJRepository : IUserFollowDJRepository
    {
        private readonly List<UserFollowDJ> _rows = new();
        public IReadOnlyList<UserFollowDJ> Rows => _rows;

        public FakeUserFollowDJRepository(params UserFollowDJ[] seed) => _rows.AddRange(seed);

        public Task<UserFollowDJ?> GetAsync(string userId, Guid djId)
            => Task.FromResult(_rows.FirstOrDefault(r => r.UserId == userId && r.DJId == djId));

        public Task<UserFollowDJ> AddAsync(UserFollowDJ entity)
        {
            _rows.Add(entity);
            return Task.FromResult(entity);
        }

        public Task DeleteAsync(UserFollowDJ entity)
        {
            _rows.Remove(entity);
            return Task.CompletedTask;
        }

        // Unused surface.
        public Task<int> CountByDjIdAsync(Guid djId) => throw new NotSupportedException();
        public Task<Dictionary<Guid, int>> GetFollowerCountsAsync(IEnumerable<Guid> djIds) => throw new NotSupportedException();
        public Task<IEnumerable<UserFollowDJ>> GetByUserIdAsync(string userId) => throw new NotSupportedException();
        public Task<UserFollowDJ?> GetByIdAsync(object id) => throw new NotSupportedException();
        public Task<IEnumerable<UserFollowDJ>> GetAllAsync() => throw new NotSupportedException();
        public Task UpdateAsync(UserFollowDJ entity) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(object id) => throw new NotSupportedException();
        public Task<int> SaveChangesAsync() => throw new NotSupportedException();
    }

    // In-memory append-only audit repo. Captures rows so WS2 tests can assert what was
    // recorded; mirrors the real repo's filter semantics. No Update/Delete (append-only).
    internal sealed class FakeAuditLogRepository : IAuditLogRepository
    {
        public List<AuditLog> Rows { get; } = new();

        public Task AddAsync(AuditLog entry)
        {
            Rows.Add(entry);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<AuditLog>> QueryAsync(
            string? entityName = null, string? entityId = null, string? userId = null,
            int skip = 0, int take = 100)
        {
            IEnumerable<AuditLog> q = Rows;
            if (!string.IsNullOrEmpty(entityName)) q = q.Where(a => a.EntityName == entityName);
            if (!string.IsNullOrEmpty(entityId)) q = q.Where(a => a.EntityId == entityId);
            if (!string.IsNullOrEmpty(userId)) q = q.Where(a => a.UserId == userId);
            return Task.FromResult<IReadOnlyList<AuditLog>>(
                q.OrderByDescending(a => a.Timestamp).Skip(skip).Take(take).ToList());
        }
    }

    // UnitOfWork exposing only Tickets / Users / UserFollowDJs (what the authz tests need).
    // SaveChangesAsync is a no-op so a denied path that never reaches it, and an allowed path
    // that does, both behave deterministically.
    internal sealed class AuthzUnitOfWork : IUnitOfWork
    {
        public AuthzUnitOfWork(
            ITicketRepository? tickets = null,
            IUserRepository? users = null,
            IUserFollowDJRepository? follows = null,
            IAuditLogRepository? audit = null)
        {
            _tickets = tickets!;
            _users = users!;
            _follows = follows!;
            _audit = audit!;
        }

        private readonly ITicketRepository _tickets;
        private readonly IUserRepository _users;
        private readonly IUserFollowDJRepository _follows;
        private readonly IAuditLogRepository _audit;
        public int SaveChangesCount { get; private set; }

        public ITicketRepository Tickets => _tickets;
        public IUserRepository Users => _users;
        public IUserFollowDJRepository UserFollowDJs => _follows;
        public IAuditLogRepository AuditLogs => _audit;

        public Task<int> SaveChangesAsync()
        {
            SaveChangesCount++;
            return Task.FromResult(0);
        }

        // Out of scope.
        public IEventRepository Events => throw new NotSupportedException();
        public IOrderRepository Orders => throw new NotSupportedException();
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

    // No-op email service. Ownership-denied paths never send mail, so every method throwing
    // NotSupportedException would actually be a valid guard — but allowed paths in
    // TransferTicket DO email the new owner, so return CompletedTask everywhere to keep the
    // happy-path test honest without asserting on email.
    internal sealed class NoopEmailService : IEmailService
    {
        public Task SendTicketConfirmationAsync(string toEmail, string toName, string ticketNumber, string eventTitle, DateTime eventDate, string venueName, string venueCity, decimal totalPrice, string qrCode) => Task.CompletedTask;
        public Task SendOrderConfirmationAsync(OrderConfirmationEmail email) => Task.CompletedTask;
        public Task SendTicketTransferConfirmationAsync(string toEmail, string toName, string ticketNumber, string eventTitle, DateTime eventDate, string venueName, string qrCode) => Task.CompletedTask;
        public Task SendRefundConfirmationAsync(string toEmail, string toName, string ticketNumber, string eventTitle, decimal refundAmount, string transactionId) => Task.CompletedTask;
        public Task SendDJApplicationSubmittedAsync(string toEmail, string toName, string stageName) => Task.CompletedTask;
        public Task SendAdminDJApplicationNotificationAsync(string adminEmail, string applicantName, string stageName) => Task.CompletedTask;
        public Task SendDJApplicationApprovedAsync(string toEmail, string toName, string stageName) => Task.CompletedTask;
        public Task SendDJApplicationRejectedAsync(string toEmail, string toName, string stageName, string? reason) => Task.CompletedTask;
        public Task SendWelcomeEmailAsync(string toEmail, string toName) => Task.CompletedTask;
        public Task SendNewsletterWelcomeAsync(string toEmail) => Task.CompletedTask;
        public Task SendContactConfirmationAsync(string toEmail, string toName) => Task.CompletedTask;
        public Task SendContactAdminNotificationAsync(string adminEmail, string senderName, string senderEmail, string message) => Task.CompletedTask;
        public Task SendPasswordResetAsync(string toEmail, string toName, string resetLink) => Task.CompletedTask;
    }

    // Minimal IPaymentProvider — never invoked by the ownership-guard paths under test.
    // WS2: RefundCalled flips true if RefundAsync is ever hit (and it still throws loudly) so a
    // test can prove the OrderItemId=null refund path never touched the payment provider.
    internal sealed class UnusedPaymentProvider : IPaymentProvider
    {
        public bool RefundCalled { get; private set; }
        public string Name => "Unused";
        public Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct) => throw new NotSupportedException();
        public Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct) => throw new NotSupportedException();
        public Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct) => throw new NotSupportedException();
        public Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
        {
            RefundCalled = true;
            throw new NotSupportedException();
        }
        public Task CancelAsync(string providerRef, CancellationToken ct) => throw new NotSupportedException();
        public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers) => throw new NotSupportedException();
        public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers) => throw new NotSupportedException();
    }
}
