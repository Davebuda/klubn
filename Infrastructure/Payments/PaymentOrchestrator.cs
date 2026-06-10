using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using DJDiP.Infrastructure.Persistance;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DJDiP.Infrastructure.Payments
{
    // Real orchestration (design §3/§6), implemented in INFRASTRUCTURE so it may use EF
    // + AppDbContext. NOTE on the earlier P5 mistake: orchestration must NOT live in
    // Application (which has no EF reference) — only the IPaymentOrchestrator interface
    // belongs there. This class is provider-agnostic: it talks to IPaymentProviderRegistry,
    // IPaymentProvider and IQrTokenService only.
    //
    // C3 (design §4.3): the orchestrator no longer holds ONE injected provider. CreatePayment
    // initiates through the registry's DEFAULT provider; Finalize/capture resolve the provider
    // from the Payment ROW (payment.Provider) — the row knows who initiated it, so a config
    // flip (e.g. Vipps→Stripe) can no longer break reconcile for an in-flight Vipps order.
    public sealed class PaymentOrchestrator : IPaymentOrchestrator
    {
        private readonly AppDbContext _db;
        private readonly IPaymentProviderRegistry _registry;
        private readonly IQrTokenService _qr;
        private readonly TicketingOptions _opts;
        private readonly ILogger<PaymentOrchestrator> _log;

        public PaymentOrchestrator(
            AppDbContext db,
            IPaymentProviderRegistry registry,
            IQrTokenService qr,
            IOptions<TicketingOptions> opts,
            ILogger<PaymentOrchestrator> log)
        {
            _db = db;
            _registry = registry;
            _qr = qr;
            _opts = opts.Value;
            _log = log;
        }

        // ---- Checkout -------------------------------------------------------------

        public async Task<CreatePaymentResult> CreatePaymentAsync(
            Guid eventId,
            IReadOnlyList<OrderLineRequest> lines,
            string? customerEmail,
            string? actingUserId,
            CancellationToken ct)
        {
            if (lines is null || lines.Count == 0)
                throw new InvalidOperationException("Your cart is empty.");

            // Guest checkout would require Order.UserId (a non-nullable FK) to become
            // nullable — a schema change out of scope for this slice. Require auth for now.
            if (string.IsNullOrEmpty(actingUserId))
                throw new InvalidOperationException("Authentication required to buy tickets.");

            // C3: initiate through the DEFAULT provider (C4 will let a checkout pick one).
            // Its name is stamped on the Payment row so every later step (finalize, reconcile,
            // webhook routing) resolves the SAME provider from the row, never global config.
            var provider = _registry.Resolve(_registry.DefaultProvider);

            // Collapse duplicate lines for the same tier.
            var requested = lines
                .GroupBy(l => l.TicketTypeId)
                .Select(g => new { TicketTypeId = g.Key, Quantity = g.Sum(x => x.Quantity) })
                .ToList();

            if (requested.Any(r => r.Quantity <= 0))
                throw new InvalidOperationException("Ticket quantity must be at least 1.");

            var typeIds = requested.Select(r => r.TicketTypeId).ToList();
            var types = await _db.TicketTypes
                .Where(t => typeIds.Contains(t.Id) && t.EventId == eventId)
                .ToDictionaryAsync(t => t.Id, ct);

            if (types.Count != requested.Count)
                throw new InvalidOperationException("One or more ticket types were not found for this event.");

            var now = DateTime.UtcNow;
            foreach (var r in requested)
            {
                var t = types[r.TicketTypeId];
                if (t.Status != TicketTypeStatus.OnSale)
                    throw new InvalidOperationException($"\"{t.Name}\" is not on sale.");
                if (t.SalesStart.HasValue && now < t.SalesStart.Value)
                    throw new InvalidOperationException($"Sales for \"{t.Name}\" have not started yet.");
                if (t.SalesEnd.HasValue && now > t.SalesEnd.Value)
                    throw new InvalidOperationException($"Sales for \"{t.Name}\" have ended.");
                if (r.Quantity < t.MinPerOrder)
                    throw new InvalidOperationException($"Minimum {t.MinPerOrder} for \"{t.Name}\".");
                if (r.Quantity > t.MaxPerOrder)
                    throw new InvalidOperationException($"Maximum {t.MaxPerOrder} per order for \"{t.Name}\".");
            }

            var reference = "klubn-" + Guid.NewGuid().ToString("N")[..8];

            var order = new Order
            {
                Id = Guid.NewGuid(),
                UserId = actingUserId,
                OrderDate = now,
                Status = OrderStatus.Pending,
                Reference = reference,
                CustomerEmail = customerEmail,
                HoldExpiresAt = now.AddMinutes(_opts.HoldMinutes),
                OrderItems = new List<OrderItem>(),
                Holds = new List<TicketHold>()
            };

            long subtotalMinor = 0, vatMinor = 0, totalMinor = 0;
            var summaryLines = new List<OrderLineSummary>();

            foreach (var r in requested)
            {
                var t = types[r.TicketTypeId];
                var lineTotal = checked(t.PriceMinor * r.Quantity);      // gross, VAT-inclusive
                var net = (long)Math.Round(lineTotal / (1m + t.VATRate), MidpointRounding.AwayFromZero);
                var vat = lineTotal - net;

                totalMinor += lineTotal;
                subtotalMinor += net;
                vatMinor += vat;

                order.OrderItems.Add(new OrderItem
                {
                    Id = Guid.NewGuid(),
                    OrderId = order.Id,
                    EventId = eventId,
                    TicketTypeId = t.Id,
                    Quantity = r.Quantity,
                    UnitPriceMinor = t.PriceMinor,
                    UnitVatRate = t.VATRate,
                    LineTotalMinor = lineTotal
                });

                order.Holds.Add(new TicketHold
                {
                    Id = Guid.NewGuid(),
                    OrderId = order.Id,
                    TicketTypeId = t.Id,
                    Quantity = r.Quantity,
                    ExpiresAt = order.HoldExpiresAt!.Value,
                    Status = TicketHoldStatus.Active,
                    CreatedAt = now
                });

                summaryLines.Add(new OrderLineSummary(
                    TicketTypeName: t.Name,
                    Quantity: r.Quantity,
                    AdmitCount: t.AdmitCount,
                    UnitPriceMinor: t.PriceMinor,
                    VatRate: t.VATRate,
                    LineTotalMinor: lineTotal));
            }

            order.TotalAmount = totalMinor / 100m;

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                Amount = order.TotalAmount,
                Currency = "NOK",
                PaymentMethod = provider.Name,
                Provider = provider.Name,
                ProviderReference = reference,        // == Order.Reference; UNIQUE
                IdempotencyKey = reference,
                Status = PaymentStatus.Created,        // persisted BEFORE InitiateAsync
                PaymentDate = now,
                AuthorizedAmountMinor = 0
            };

            // Oversell-safe reservation + persistence in one transaction. The conditional
            // UPDATE is the real backstop (the DB CHECK constraint is the second). Quoted
            // identifiers keep it valid on both SQLite (dev) and PostgreSQL (prod).
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            foreach (var r in requested)
            {
                var affected = await _db.Database.ExecuteSqlInterpolatedAsync(
                    $@"UPDATE ""TicketTypes""
                       SET ""QuantityHeld"" = ""QuantityHeld"" + {r.Quantity}
                       WHERE ""Id"" = {r.TicketTypeId}
                         AND (""Capacity"" - ""QuantitySold"" - ""QuantityHeld"") >= {r.Quantity}", ct);

                if (affected != 1)
                {
                    await tx.RollbackAsync(ct);
                    throw new InvalidOperationException($"\"{types[r.TicketTypeId].Name}\" is sold out or has too few left.");
                }
            }

            _db.Orders.Add(order);
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);   // Reference + Payment(Created) durable BEFORE initiate

            // Provider initiate (idempotent recovery via GetStatusAsync on failure).
            var sep = _opts.CheckoutReturnUrl.Contains('?') ? '&' : '?';
            var returnUrl = _opts.CheckoutReturnUrl;
            InitiateResult init;
            try
            {
                init = await provider.InitiateAsync(new InitiateRequest(
                    OrderRef: reference,
                    Amount: new Money(totalMinor, "NOK"),
                    ReturnUrl: returnUrl,
                    IdempotencyKey: reference,
                    Description: $"Klubn tickets {reference}",
                    CustomerEmail: customerEmail), ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Provider initiate failed for {Reference}; order persisted as Created for reconcile.", reference);
                throw new InvalidOperationException("Could not start payment. Please try again.");
            }

            payment.ProviderPspReference = init.ProviderReference;
            payment.LastSyncedAt = now;
            await _db.SaveChangesAsync(ct);

            var summary = new OrderSummary(
                Reference: reference,
                Lines: summaryLines,
                SubtotalMinor: subtotalMinor,
                VatMinor: vatMinor,
                TotalMinor: totalMinor,
                Currency: "NOK");

            return new CreatePaymentResult(summary, init.RedirectUrl);
        }

        // ---- Finalize (webhook + poll share this idempotent path) -----------------

        public async Task FinalizeAsync(PaymentEvent ev, CancellationToken ct, string? viaProvider = null)
        {
            // Charge-level events (e.g. Stripe charge.refunded) carry no order metadata,
            // so ev.OrderRef arrives empty — fall back to the PSP reference we stored at
            // authorize/capture time. One lookup path, two keys; never a second issue path.
            var payment = !string.IsNullOrEmpty(ev.OrderRef)
                ? await _db.Payments.FirstOrDefaultAsync(p => p.ProviderReference == ev.OrderRef, ct)
                : null;
            if (payment is null && !string.IsNullOrEmpty(ev.PspRef))
                payment = await _db.Payments.FirstOrDefaultAsync(p => p.ProviderPspReference == ev.PspRef, ct);

            if (payment is null)
            {
                _log.LogWarning("FinalizeAsync: no payment for OrderRef {OrderRef} / PspRef {PspRef}; ignoring.",
                    ev.OrderRef, ev.PspRef);
                return;
            }

            // C3 cross-provider misdelivery guard (design §8): a webhook passes the route
            // segment it arrived on as viaProvider. If that doesn't match the provider that
            // actually initiated this Payment (the row is authoritative), the event came in
            // on the wrong provider's endpoint — e.g. a stale Vipps redirect hitting /stripe.
            // WARN + ignore; never process. Poll paths pass null and skip this check.
            if (!string.IsNullOrEmpty(viaProvider) &&
                !string.Equals(payment.Provider, viaProvider, StringComparison.OrdinalIgnoreCase))
            {
                _log.LogWarning("FinalizeAsync: provider mismatch for {OrderRef} — payment.Provider={PaymentProvider}, arrived via {ViaProvider}; ignoring.",
                    ev.OrderRef, payment.Provider, viaProvider);
                return;
            }

            // Layer-1 idempotency: a UNIQUE (Provider, ProviderPspReference, EventType)
            // row. A duplicate delivery throws on SaveChanges and is a no-op. The provider
            // is the ROW's provider (C3) — the payment knows who initiated it.
            var dedup = new PaymentWebhookEvent
            {
                Id = Guid.NewGuid(),
                Provider = payment.Provider,
                ProviderPspReference = ev.PspRef ?? ev.OrderRef,
                EventType = ev.Type.ToString(),
                ReceivedAt = DateTime.UtcNow
            };
            _db.PaymentWebhookEvents.Add(dedup);
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                _db.Entry(dedup).State = EntityState.Detached;
                _log.LogInformation("FinalizeAsync: duplicate {Type} for {OrderRef}; no-op.", ev.Type, ev.OrderRef);
                return;
            }

            switch (ev.Type)
            {
                case PaymentEventType.Captured:
                    await CaptureAndIssueAsync(payment, ev, ct);
                    break;
                case PaymentEventType.Authorized:
                    await SetAuthorizedAsync(payment, ev, ct);
                    break;
                case PaymentEventType.Failed:
                case PaymentEventType.Expired:
                case PaymentEventType.Cancelled:
                    await ReleaseAsync(payment, ev, ct);
                    break;
                case PaymentEventType.Refunded:
                    payment.Status = PaymentStatus.Refunded;
                    payment.RefundedAmountMinor = ev.Amount.AmountMinor;
                    payment.LastSyncedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync(ct);
                    break;
            }
        }

        private async Task SetAuthorizedAsync(Payment payment, PaymentEvent ev, CancellationToken ct)
        {
            if (payment.Status is PaymentStatus.Captured or PaymentStatus.Authorized) return;
            payment.Status = PaymentStatus.Authorized;
            payment.AuthorizedAmountMinor = ev.Amount.AmountMinor;
            payment.ProviderPspReference = ev.PspRef ?? payment.ProviderPspReference;
            payment.LastSyncedAt = DateTime.UtcNow;

            var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == payment.OrderId, ct);
            if (order is not null && order.Status == OrderStatus.Pending)
                order.Status = OrderStatus.Reserved;

            await _db.SaveChangesAsync(ct);
        }

        private async Task CaptureAndIssueAsync(Payment payment, PaymentEvent ev, CancellationToken ct)
        {
            if (payment.Status == PaymentStatus.Captured) return; // already issued

            var order = await _db.Orders
                .Include(o => o.OrderItems)
                .Include(o => o.Holds)
                .FirstOrDefaultAsync(o => o.Id == payment.OrderId, ct);
            if (order is null)
            {
                _log.LogError("CaptureAndIssue: order {OrderId} missing.", payment.OrderId);
                return;
            }

            // Money sanity guard (mirrors the H1 reconcile guard): a verified event can
            // still carry drifted values (settlement-currency change, Dashboard-side
            // partial capture). Wrong currency never issues; an amount drift issues from
            // DB truth but is logged loudly for reconciliation.
            if (!string.Equals(ev.Amount.Currency, payment.Currency, StringComparison.OrdinalIgnoreCase))
            {
                _log.LogError("CaptureAndIssue: currency mismatch for {Reference} (event {EventCurrency}, payment {PaymentCurrency}); NOT issuing.",
                    payment.ProviderReference, ev.Amount.Currency, payment.Currency);
                return;
            }
            var expectedMinor = payment.AuthorizedAmountMinor > 0
                ? payment.AuthorizedAmountMinor
                : (long)Math.Round(order.TotalAmount * 100m, MidpointRounding.AwayFromZero);
            if (ev.Amount.AmountMinor != expectedMinor)
                _log.LogWarning("CaptureAndIssue: captured amount {EventMinor} differs from expected {ExpectedMinor} for {Reference}.",
                    ev.Amount.AmountMinor, expectedMinor, payment.ProviderReference);

            // Event start drives QR expiry (no explicit end time in the model).
            var eventIds = order.OrderItems.Select(i => i.EventId).Distinct().ToList();
            var events = await _db.Events.Where(e => eventIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);

            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            // EXACTLY-ONCE GUARD (prevents double ticket issuance). Two finalize paths
            // can both clear layer-1 dedup when they carry different PspRefs (e.g. a real
            // webhook vs the status-poll/sandbox synthetic ref). This atomic compare-and-
            // swap on Payment.Status is the real guard: the first transaction to flip the
            // row to Captured wins and issues; any concurrent/late finalizer sees 0 rows
            // affected and bails WITHOUT issuing. Row-level locking serializes the racers.
            var claimed = await _db.Database.ExecuteSqlInterpolatedAsync(
                $@"UPDATE ""Payments"" SET ""Status"" = {(int)PaymentStatus.Captured}
                   WHERE ""Id"" = {payment.Id} AND ""Status"" <> {(int)PaymentStatus.Captured}", ct);
            if (claimed != 1)
            {
                await tx.RollbackAsync(ct);
                _log.LogInformation("CaptureAndIssue: {Reference} already captured by another path; no-op.", order.Reference);
                return;
            }

            // Commit each hold: held -> sold (atomic, never goes negative).
            foreach (var hold in order.Holds.Where(h => h.Status == TicketHoldStatus.Active))
            {
                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $@"UPDATE ""TicketTypes""
                       SET ""QuantitySold"" = ""QuantitySold"" + {hold.Quantity},
                           ""QuantityHeld"" = CASE WHEN ""QuantityHeld"" >= {hold.Quantity}
                                                   THEN ""QuantityHeld"" - {hold.Quantity} ELSE 0 END
                       WHERE ""Id"" = {hold.TicketTypeId}", ct);
                hold.Status = TicketHoldStatus.Committed;
            }

            // Issue one Ticket per unit; each admits AdmitCount people.
            foreach (var item in order.OrderItems)
            {
                var type = await _db.TicketTypes.FirstOrDefaultAsync(t => t.Id == item.TicketTypeId, ct);
                var admit = type?.AdmitCount ?? 1;

                long expiryEpoch;
                if (events.TryGetValue(item.EventId, out var evt))
                    expiryEpoch = new DateTimeOffset(evt.Date.ToUniversalTime())
                        .AddHours(_opts.QrExpiryBufferHours).ToUnixTimeSeconds();
                else
                    expiryEpoch = DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeSeconds();

                var unitGross = item.UnitPriceMinor / 100m;
                var vatAmount = unitGross - Math.Round(unitGross / (1m + item.UnitVatRate), 2, MidpointRounding.AwayFromZero);

                for (var n = 0; n < item.Quantity; n++)
                {
                    var ticketId = Guid.NewGuid();
                    var token = _qr.Issue(new QrTokenData(ticketId, item.EventId, admit, expiryEpoch));

                    _db.Tickets.Add(new Ticket
                    {
                        Id = ticketId,
                        EventId = item.EventId,
                        UserId = order.UserId,
                        TicketNumber = order.Reference + "-" + (n + 1),
                        QRCode = token,
                        OrderItemId = item.Id,
                        TicketTypeId = item.TicketTypeId,
                        AdmitCount = admit,
                        AdmitsRemaining = admit,
                        BasePrice = unitGross - vatAmount,
                        VATRate = item.UnitVatRate,
                        VATAmount = vatAmount,
                        TotalPrice = unitGross,
                        IsValid = true,
                        IsUsed = false,
                        Status = TicketStatus.Active,
                        PurchaseDate = DateTime.UtcNow
                    });
                }
            }

            payment.Status = PaymentStatus.Captured;
            payment.CapturedAmountMinor = ev.Amount.AmountMinor;
            payment.ProviderPspReference = ev.PspRef ?? payment.ProviderPspReference;
            payment.LastSyncedAt = DateTime.UtcNow;
            order.Status = OrderStatus.Fulfilled;
            order.HoldExpiresAt = null;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            _log.LogInformation("Issued tickets for order {Reference} ({Count} items).",
                order.Reference, order.OrderItems.Count);
        }

        private async Task ReleaseAsync(Payment payment, PaymentEvent ev, CancellationToken ct)
        {
            if (payment.Status is PaymentStatus.Captured) return; // can't release a paid order here

            var order = await _db.Orders.Include(o => o.Holds)
                .FirstOrDefaultAsync(o => o.Id == payment.OrderId, ct);
            if (order is null) return;

            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            foreach (var hold in order.Holds.Where(h => h.Status == TicketHoldStatus.Active))
            {
                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $@"UPDATE ""TicketTypes""
                       SET ""QuantityHeld"" = CASE WHEN ""QuantityHeld"" >= {hold.Quantity}
                                                   THEN ""QuantityHeld"" - {hold.Quantity} ELSE 0 END
                       WHERE ""Id"" = {hold.TicketTypeId}", ct);
                hold.Status = ev.Type == PaymentEventType.Expired
                    ? TicketHoldStatus.Expired
                    : TicketHoldStatus.Released;
            }

            payment.Status = ev.Type switch
            {
                PaymentEventType.Failed => PaymentStatus.Failed,
                PaymentEventType.Expired => PaymentStatus.Expired,
                PaymentEventType.Cancelled => PaymentStatus.Aborted,
                _ => payment.Status
            };
            payment.LastSyncedAt = DateTime.UtcNow;
            order.Status = ev.Type == PaymentEventType.Expired ? OrderStatus.Expired : OrderStatus.Cancelled;
            order.HoldExpiresAt = null;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
    }
}
