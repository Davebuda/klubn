using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using DJDiP.Infrastructure.Payments;
using DJDiP.Infrastructure.Persistance;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace DJDiP.Tests
{
    // Real-SQLite (in-memory, connection kept open for the life of the harness) harness for
    // PaymentOrchestrator integration tests. Using REAL SQLite — not the EF in-memory
    // provider — is deliberate: the orchestrator's correctness lives in raw
    // ExecuteSqlInterpolatedAsync statements (inventory CAS, promo UsageCount CAS, order-level
    // CAS) with double-quoted identifiers, which only a relational provider executes. The
    // EF in-memory provider would silently no-op them.
    internal sealed class OrchestratorTestHarness : IDisposable
    {
        public SqliteConnection Connection { get; }
        public AppDbContext Db { get; }
        public FakePromoCodeService Promo { get; }
        public RecordingConfirmationService Confirmation { get; }
        public RecordingProvider Provider { get; }
        public IPaymentProviderRegistry Registry { get; }
        public PaymentOrchestrator Orchestrator { get; }

        public OrchestratorTestHarness(
            FakePromoCodeService? promo = null,
            RecordingProvider? provider = null,
            string providerName = "Sandbox",
            int holdMinutes = 10)
        {
            Connection = new SqliteConnection("DataSource=:memory:");
            Connection.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(Connection)
                .Options;
            Db = new AppDbContext(options);
            Db.Database.EnsureCreated();

            Promo = promo ?? new FakePromoCodeService();
            Confirmation = new RecordingConfirmationService();
            Provider = provider ?? new RecordingProvider(providerName);
            Registry = new SingleProviderRegistry(Provider);

            var qr = new QrTokenService("test-signing-secret-which-is-quite-long-enough");
            var opts = Options.Create(new TicketingOptions
            {
                CheckoutReturnUrl = "http://localhost:3000/checkout/return",
                HoldMinutes = holdMinutes
            });

            Orchestrator = new PaymentOrchestrator(
                Db, Registry, Promo, Confirmation, qr, opts,
                NullLogger<PaymentOrchestrator>.Instance);
        }

        // Seed an event + venue + one ticket type with the given capacity/price.
        public (Guid eventId, TicketType type) SeedEvent(
            long priceMinor = 50000, int capacity = 100, bool hidden = false,
            TicketTypeStatus status = TicketTypeStatus.OnSale)
        {
            var venue = new Venue { Id = Guid.NewGuid(), Name = "Klubben", City = "Oslo" };
            var ev = new Event { Id = Guid.NewGuid(), Title = "Test Night", Date = DateTime.UtcNow.AddDays(7), VenueId = venue.Id };
            var type = new TicketType
            {
                Id = Guid.NewGuid(),
                EventId = ev.Id,
                Name = "GA",
                PriceMinor = priceMinor,
                VATRate = 0.12m,
                Capacity = capacity,
                QuantitySold = 0,
                QuantityHeld = 0,
                AdmitCount = 1,
                MinPerOrder = 1,
                MaxPerOrder = 10,
                Status = status,
                IsHidden = hidden
            };
            Db.Venues.Add(venue);
            Db.Events.Add(ev);
            Db.TicketTypes.Add(type);
            Db.SaveChanges();
            return (ev.Id, type);
        }

        public ApplicationUser SeedUser()
        {
            var u = new ApplicationUser { Id = Guid.NewGuid().ToString("N"), FullName = "Test Buyer", Email = "buyer@example.com" };
            Db.ApplicationUsers.Add(u);
            Db.SaveChanges();
            return u;
        }

        public PromotionCode SeedPromo(
            string code = "SAVE10", PromoKind kind = PromoKind.Percent,
            decimal pct = 10, long amountMinor = 0, int? maxRedemptions = null,
            int usageCount = 0, bool active = true)
        {
            var promo = new PromotionCode
            {
                Id = Guid.NewGuid(),
                Code = code.ToUpperInvariant(),
                Kind = kind,
                DiscountPercentage = pct,
                AmountMinor = amountMinor,
                ValidUntil = DateTime.UtcNow.AddDays(30),
                MaxRedemptions = maxRedemptions,
                UsageCount = usageCount,
                IsActive = active
            };
            Db.PromotionCodes.Add(promo);
            Db.SaveChanges();
            return promo;
        }

        public void Dispose()
        {
            Db.Dispose();
            Connection.Dispose();
        }
    }

    // A registry that resolves a single provider by its Name (case-insensitive) and treats
    // it as both the default and the only enabled entry — the C4 single-provider shape.
    internal sealed class SingleProviderRegistry : IPaymentProviderRegistry
    {
        private readonly IPaymentProvider _provider;
        public SingleProviderRegistry(IPaymentProvider provider) => _provider = provider;

        public IReadOnlyList<string> EnabledProviders => new[] { _provider.Name };
        public string DefaultProvider => _provider.Name;
        public bool IsEnabled(string name) => string.Equals(name, _provider.Name, StringComparison.OrdinalIgnoreCase);
        public IPaymentProvider Resolve(string name) =>
            IsEnabled(name) ? _provider : throw new InvalidOperationException($"Payment provider '{name}' is not enabled.");
    }

    // Records initiate/cancel/refund calls; returns a deterministic redirect. No network.
    internal sealed class RecordingProvider : IPaymentProvider
    {
        public RecordingProvider(string name) => Name = name;
        public string Name { get; }

        public List<InitiateRequest> Initiated { get; } = new();
        public List<string> Cancelled { get; } = new();
        public List<(string Ref, Money Amount, string IdemKey)> Refunds { get; } = new();
        public bool FailInitiate { get; set; }

        public Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct)
        {
            if (FailInitiate) throw new InvalidOperationException("provider down");
            Initiated.Add(request);
            return Task.FromResult(new InitiateResult($"psp-{request.OrderRef}", $"https://pay.test/{request.OrderRef}"));
        }

        public Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct) =>
            Task.FromResult(new PaymentSnapshot(providerRef, "psp-" + providerRef, PaymentEventType.Authorized,
                Money.Nok(0), Money.Nok(0), Money.Nok(0), DateTime.UtcNow));

        public Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct) =>
            Task.FromResult(new CaptureResult("psp-" + providerRef, amount));

        public Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
        {
            Refunds.Add((providerRef, amount, idemKey));
            return Task.FromResult(new RefundResult("refund-" + providerRef, amount));
        }

        public Task CancelAsync(string providerRef, CancellationToken ct)
        {
            Cancelled.Add(providerRef);
            return Task.CompletedTask;
        }

        public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers) => true;
        public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers) =>
            throw new NotSupportedException();
    }

    // Scriptable promo validator: returns the configured result. Lets a test drive the
    // orchestrator's reserve/consume/release SQL without depending on the real validator.
    internal sealed class FakePromoCodeService : IPromoCodeService
    {
        public PromoValidationResult? Result { get; set; }
        public Func<string, Guid, IReadOnlyList<PromoLine>, string?, PromoValidationResult>? Responder { get; set; }

        public Task<PromoValidationResult> ValidateAsync(
            string code, Guid eventId, IReadOnlyList<PromoLine> lines, string? userId, CancellationToken ct)
        {
            if (Responder is not null) return Task.FromResult(Responder(code, eventId, lines, userId));
            return Task.FromResult(Result ?? PromoValidationResult.Fail(code, "This code isn't valid."));
        }
    }

    // Records confirmation sends so a test can assert the post-commit email fired exactly once.
    internal sealed class RecordingConfirmationService : IOrderConfirmationService
    {
        public List<Guid> Sent { get; } = new();
        public Task SendAsync(Guid orderId, CancellationToken ct)
        {
            Sent.Add(orderId);
            return Task.CompletedTask;
        }
    }
}
