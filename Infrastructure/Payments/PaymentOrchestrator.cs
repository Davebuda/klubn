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
    //
    // C4 (design §3.1/§3.5/§4.4): promo reserve/consume/release (hold-style, mirroring
    // inventory), per-checkout provider choice, multi-attempt retry, an order-level CAS that
    // makes fulfillment exactly-once across attempts, and a post-commit (best-effort)
    // confirmation email. The promo SQL is the ATOMIC backstop (counters never COUNT(*));
    // quoted identifiers keep every raw statement valid on SQLite (dev) AND PostgreSQL (prod).
    public sealed class PaymentOrchestrator : IPaymentOrchestrator
    {
        private readonly AppDbContext _db;
        private readonly IPaymentProviderRegistry _registry;
        private readonly IPromoCodeService _promoCodes;
        private readonly IOrderConfirmationService _confirmation;
        private readonly IQrTokenService _qr;
        private readonly TicketingOptions _opts;
        private readonly ILogger<PaymentOrchestrator> _log;

        public PaymentOrchestrator(
            AppDbContext db,
            IPaymentProviderRegistry registry,
            IPromoCodeService promoCodes,
            IOrderConfirmationService confirmation,
            IQrTokenService qr,
            IOptions<TicketingOptions> opts,
            ILogger<PaymentOrchestrator> log)
        {
            _db = db;
            _registry = registry;
            _promoCodes = promoCodes;
            _confirmation = confirmation;
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
            string? promoCode,
            string? provider,
            CancellationToken ct)
        {
            if (lines is null || lines.Count == 0)
                throw new InvalidOperationException("Your cart is empty.");

            // Guest checkout would require Order.UserId (a non-nullable FK) to become
            // nullable — a schema change out of scope for this slice. Require auth for now.
            if (string.IsNullOrEmpty(actingUserId))
                throw new InvalidOperationException("Authentication required to buy tickets.");

            // Provider choice (C4, design §4.3): validate the requested provider BEFORE any
            // state exists (design §8: "Unknown provider name at create → 400 before any
            // state"). null ⇒ default. The chosen name is stamped on the Payment row so every
            // later step (finalize, reconcile, webhook routing) resolves the SAME provider
            // from the row, never global config.
            var resolvedName = string.IsNullOrWhiteSpace(provider)
                ? _registry.DefaultProvider
                : provider;
            if (!_registry.IsEnabled(resolvedName))
                throw new InvalidOperationException("Unknown payment provider.");
            var chosenProvider = _registry.Resolve(resolvedName);

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

            // Promo validation (C4, design §4.1) — run AFTER resolving types/lines (the
            // validator needs UnitPriceMinor/VatRate/IsHidden per line). An INVALID promo at
            // create is a HARD error (design §4.1/§5: create never silently drops a discount).
            // A valid code may unlock IsHidden tiers; the unlock set covers the hidden-line
            // rejection below.
            var hasPromo = !string.IsNullOrWhiteSpace(promoCode);
            PromoValidationResult? promo = null;
            if (hasPromo)
            {
                var promoLines = requested
                    .Select(r =>
                    {
                        var t = types[r.TicketTypeId];
                        return new PromoLine(t.Id, r.Quantity, t.PriceMinor, t.VATRate, t.IsHidden);
                    })
                    .ToList();

                promo = await _promoCodes.ValidateAsync(promoCode!, eventId, promoLines, actingUserId, ct);
                if (!promo.Ok)
                    throw new InvalidOperationException(promo.Reason ?? "This code isn't valid.");
            }

            var unlocked = promo is { Ok: true }
                ? promo.UnlockedTicketTypeIds.ToHashSet()
                : new HashSet<Guid>();

            var now = DateTime.UtcNow;
            foreach (var r in requested)
            {
                var t = types[r.TicketTypeId];

                // Hidden tier: treat as not-found unless the validated promo unlocks it —
                // never leak hidden-tier existence (design §3.2). Same message as create's
                // unknown-type error.
                if (t.IsHidden && !unlocked.Contains(t.Id))
                    throw new InvalidOperationException("One or more ticket types were not found for this event.");

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

            // Per-line discount allocation (only when a promo validated Ok).
            var discountByType = promo is { Ok: true }
                ? promo.PerLineDiscounts.ToDictionary(d => d.TicketTypeId, d => d.DiscountMinor)
                : new Dictionary<Guid, long>();

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
                Holds = new List<TicketHold>(),
                PromotionCodeId = promo is { Ok: true } ? promo.PromoCodeId : null,
                PromoCode = promo is { Ok: true } ? promo.Code : null
            };

            // Totals (design §3.3/§4.1): per line, VAT is computed on the DISCOUNTED gross
            // (prices are VAT-inclusive). LineTotalMinor stays the UNDISCOUNTED gross
            // (Quantity × UnitPriceMinor — its defined meaning); OrderItem.DiscountMinor is the
            // per-line discount; Order.DiscountMinor is the total; Order.TotalAmount is the
            // discounted total; the provider Amount is the discounted total in minor units.
            long grossTotalMinor = 0, subtotalMinor = 0, vatMinor = 0, discountTotalMinor = 0;
            var summaryLines = new List<OrderLineSummary>();

            foreach (var r in requested)
            {
                var t = types[r.TicketTypeId];
                var lineGross = checked(t.PriceMinor * r.Quantity);     // gross, VAT-inclusive
                discountByType.TryGetValue(t.Id, out var lineDiscount);
                if (lineDiscount > lineGross) lineDiscount = lineGross; // never exceed gross
                var discountedGross = lineGross - lineDiscount;

                var net = (long)Math.Round(discountedGross / (1m + t.VATRate), MidpointRounding.AwayFromZero);
                var vat = discountedGross - net;

                grossTotalMinor += lineGross;
                discountTotalMinor += lineDiscount;
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
                    LineTotalMinor = lineGross,        // UNDISCOUNTED gross (Quantity × UnitPriceMinor)
                    DiscountMinor = lineDiscount
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
                    LineTotalMinor: discountedGross));
            }

            var payableMinor = grossTotalMinor - discountTotalMinor;
            order.DiscountMinor = discountTotalMinor;
            order.TotalAmount = payableMinor / 100m;

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                Amount = order.TotalAmount,
                Currency = "NOK",
                PaymentMethod = chosenProvider.Name,
                Provider = chosenProvider.Name,
                ProviderReference = reference,        // == Order.Reference; UNIQUE
                IdempotencyKey = reference,
                PromotionCodeId = order.PromotionCodeId,
                Status = PaymentStatus.Created,        // persisted BEFORE InitiateAsync
                PaymentDate = now,
                AuthorizedAmountMinor = 0,
                AttemptNo = 1
            };

            // Oversell-safe reservation + promo reservation + persistence in ONE transaction.
            // The conditional UPDATEs are the real backstops (the DB CHECK / UNIQUE indexes are
            // the second). Quoted identifiers keep them valid on SQLite (dev) and PostgreSQL.
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

            // Promo usage RESERVATION (design §3.1): atomic CAS on UsageCount vs MaxRedemptions
            // — the same oversell-style guard inventory uses. 0 rows ⇒ the code exhausted
            // between validate and here ⇒ roll the WHOLE tx back (holds too) and 409.
            if (promo is { Ok: true } && promo.PromoCodeId is { } promoId)
            {
                var reserved = await _db.Database.ExecuteSqlInterpolatedAsync(
                    $@"UPDATE ""PromotionCodes""
                       SET ""UsageCount"" = ""UsageCount"" + 1
                       WHERE ""Id"" = {promoId}
                         AND ""IsActive"" = {true}
                         AND (""MaxRedemptions"" IS NULL OR ""UsageCount"" < ""MaxRedemptions"")", ct);

                if (reserved != 1)
                {
                    await tx.RollbackAsync(ct);
                    throw new InvalidOperationException("This code is no longer available.");
                }

                // Per-user cap — enforced ATOMICALLY inside this same tx (design §3.1/§7).
                // The validator's per-user count (PromoCodeService) is advisory only: it races
                // a concurrent second order by the same user, so on its own it cannot stop a
                // user exceeding MaxRedemptionsPerUser. After the GLOBAL UsageCount CAS wins,
                // re-count THIS user's still-live (Reserved|Consumed) rows for this promo within
                // the transaction (EF LINQ runs on the same connection/tx). The current order's
                // row hasn't been inserted yet, so it is correctly excluded from the count.
                // count >= cap ⇒ roll the WHOLE tx back (releasing the inventory hold AND the
                // UsageCount we just incremented) and reject. We re-read the cap from the row
                // because the validation result doesn't carry it.
                var perUserCap = await _db.PromotionCodes
                    .Where(p => p.Id == promoId)
                    .Select(p => p.MaxRedemptionsPerUser)
                    .FirstOrDefaultAsync(ct);
                if (perUserCap.HasValue)
                {
                    var userLive = await _db.Set<PromoRedemption>()
                        .CountAsync(rd => rd.PromoCodeId == promoId
                                          && rd.UserId == actingUserId
                                          && (rd.Status == PromoRedemptionStatus.Reserved
                                              || rd.Status == PromoRedemptionStatus.Consumed), ct);
                    if (userLive >= perUserCap.Value)
                    {
                        await tx.RollbackAsync(ct);
                        // Message kept consistent with PromoCodeService's advisory check.
                        throw new InvalidOperationException("You've already used this code.");
                    }
                }

                // Audit + per-user-limit row. The UNIQUE(OrderId) index is the backstop.
                _db.Set<PromoRedemption>().Add(new PromoRedemption
                {
                    Id = Guid.NewGuid(),
                    PromoCodeId = promoId,
                    OrderId = order.Id,
                    UserId = actingUserId,
                    Status = PromoRedemptionStatus.Reserved,
                    CreatedAt = now
                });
            }

            _db.Orders.Add(order);
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);   // Reference + Payment(Created) durable BEFORE initiate

            var summary = new OrderSummary(
                Reference: reference,
                Lines: summaryLines,
                SubtotalMinor: subtotalMinor,
                VatMinor: vatMinor,
                TotalMinor: payableMinor,
                Currency: "NOK");

            // Zero-total (100%-discount) order (design §3.1/§8): a free order is legal. Skip
            // InitiateAsync entirely and finalize through the SAME FinalizeAsync path via a
            // synthesized free-capture event (dedup + CAS + promo consume all apply). The
            // redirect is the normal return URL with the reference appended, so the frontend
            // flow is identical. NOTE: a reconcile racing this may call the provider's
            // GetStatus for a payment that was never initiated and error transiently; the
            // next tick sees the order already Captured and is a clean no-op.
            if (payableMinor == 0)
            {
                var freeEvent = new PaymentEvent(
                    OrderRef: reference,
                    PspRef: "free-" + reference,
                    Type: PaymentEventType.Captured,
                    Amount: new Money(0, "NOK"),
                    OccurredAt: DateTime.UtcNow,
                    RawPayload: "{\"free\":true}");
                await FinalizeAsync(freeEvent, ct);

                var freeSep = _opts.CheckoutReturnUrl.Contains('?') ? '&' : '?';
                var freeRedirect = $"{_opts.CheckoutReturnUrl}{freeSep}reference={Uri.EscapeDataString(reference)}";
                return new CreatePaymentResult(summary, freeRedirect, chosenProvider.Name);
            }

            // Provider initiate (idempotent recovery via GetStatusAsync on failure).
            var returnUrl = _opts.CheckoutReturnUrl;
            InitiateResult init;
            try
            {
                init = await chosenProvider.InitiateAsync(new InitiateRequest(
                    OrderRef: reference,
                    Amount: new Money(payableMinor, "NOK"),
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

            return new CreatePaymentResult(summary, init.RedirectUrl, chosenProvider.Name);
        }

        // ---- Retry (multi-attempt; design §3.5/§6) --------------------------------

        public async Task<CreatePaymentResult> RetryPaymentAsync(
            string reference,
            string? provider,
            string actingUserId,
            CancellationToken ct)
        {
            if (string.IsNullOrEmpty(actingUserId))
                throw new InvalidOperationException("Authentication required to buy tickets.");

            var order = await _db.Orders
                .Include(o => o.Holds)
                .Include(o => o.OrderItems)
                .Include(o => o.Payments)
                .FirstOrDefaultAsync(o => o.Reference == reference, ct);

            if (order is null)
                throw new InvalidOperationException("Order not found.");
            if (order.UserId != actingUserId)
                throw new InvalidOperationException("You can only retry your own order.");

            // Reject if already paid (design §3.5 step 4).
            if (order.Payments.Any(p => p.Status == PaymentStatus.Captured) ||
                order.Status is OrderStatus.Paid or OrderStatus.Fulfilled or OrderStatus.Refunded)
                throw new InvalidOperationException("This order is already paid.");

            // Provider choice for the new attempt (null ⇒ default; IsEnabled-checked).
            var resolvedName = string.IsNullOrWhiteSpace(provider)
                ? _registry.DefaultProvider
                : provider;
            if (!_registry.IsEnabled(resolvedName))
                throw new InvalidOperationException("Unknown payment provider.");
            var chosenProvider = _registry.Resolve(resolvedName);

            // Best-effort cancel the latest non-terminal attempt (design §3.5 step 4). Its OWN
            // provider — never the new one. Cancel failure is logged and ignored.
            var latest = order.Payments
                .OrderByDescending(p => p.AttemptNo)
                .FirstOrDefault();
            if (latest is not null &&
                latest.Status is PaymentStatus.Created or PaymentStatus.Authorized)
            {
                try
                {
                    var prevProvider = _registry.Resolve(latest.Provider);
                    await prevProvider.CancelAsync(latest.ProviderReference, ct);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Retry: cancel of previous attempt {Reference} failed; continuing.", latest.ProviderReference);
                }
                latest.Status = PaymentStatus.Aborted;
            }

            var now = DateTime.UtcNow;
            var attemptNo = order.Payments.Count == 0 ? 1 : order.Payments.Max(p => p.AttemptNo) + 1;
            var attemptRef = $"{order.Reference}-r{attemptNo}";

            // Re-reserve released holds + the promo reservation, and create the new Payment row
            // BEFORE InitiateAsync — all inside one transaction (the seam invariant: a Created
            // Payment row exists before we ever ask a provider to start).
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            foreach (var hold in order.Holds)
            {
                if (hold.Status == TicketHoldStatus.Active)
                    continue; // still held; nothing to re-reserve

                var affected = await _db.Database.ExecuteSqlInterpolatedAsync(
                    $@"UPDATE ""TicketTypes""
                       SET ""QuantityHeld"" = ""QuantityHeld"" + {hold.Quantity}
                       WHERE ""Id"" = {hold.TicketTypeId}
                         AND (""Capacity"" - ""QuantitySold"" - ""QuantityHeld"") >= {hold.Quantity}", ct);

                if (affected != 1)
                {
                    await tx.RollbackAsync(ct);
                    throw new InvalidOperationException("Tickets for this order are sold out — the hold expired and could not be re-reserved.");
                }
                hold.Status = TicketHoldStatus.Active;
            }

            // Re-reserve the promo if it was released by the sweeper/expiry. Totals were
            // computed WITH the discount, so we must NOT silently drop it — hard error if the
            // code is no longer available (design §3.5).
            if (order.PromotionCodeId is { } promoId)
            {
                var redemption = await _db.Set<PromoRedemption>()
                    .FirstOrDefaultAsync(rd => rd.OrderId == order.Id, ct);
                if (redemption is not null && redemption.Status == PromoRedemptionStatus.Released)
                {
                    var reserved = await _db.Database.ExecuteSqlInterpolatedAsync(
                        $@"UPDATE ""PromotionCodes""
                           SET ""UsageCount"" = ""UsageCount"" + 1
                           WHERE ""Id"" = {promoId}
                             AND ""IsActive"" = {true}
                             AND (""MaxRedemptions"" IS NULL OR ""UsageCount"" < ""MaxRedemptions"")", ct);

                    if (reserved != 1)
                    {
                        await tx.RollbackAsync(ct);
                        throw new InvalidOperationException("This code is no longer available.");
                    }

                    // Per-user cap, re-checked atomically in-tx (design §3.1/§7), same as create.
                    // EDGE CASE: THIS order's redemption row already exists with Status=Released
                    // (we're about to flip it back to Reserved) — it was already counted against
                    // the user when first reserved, so it must NOT self-block. We therefore count
                    // OTHER (OrderId != this) still-live Reserved|Consumed rows for the user and
                    // require that to be < cap. Done BEFORE the flip; excluding by OrderId makes
                    // it order-independent regardless.
                    var retryCap = await _db.PromotionCodes
                        .Where(p => p.Id == promoId)
                        .Select(p => p.MaxRedemptionsPerUser)
                        .FirstOrDefaultAsync(ct);
                    if (retryCap.HasValue)
                    {
                        var otherLive = await _db.Set<PromoRedemption>()
                            .CountAsync(rd => rd.PromoCodeId == promoId
                                              && rd.UserId == actingUserId
                                              && rd.OrderId != order.Id
                                              && (rd.Status == PromoRedemptionStatus.Reserved
                                                  || rd.Status == PromoRedemptionStatus.Consumed), ct);
                        if (otherLive >= retryCap.Value)
                        {
                            await tx.RollbackAsync(ct);
                            throw new InvalidOperationException("You've already used this code.");
                        }
                    }

                    redemption.Status = PromoRedemptionStatus.Reserved;
                }
            }

            // Amount derived from the ORDER's line items (gross − per-line discount), not from
            // the decimal TotalAmount, to avoid a decimal→minor round-trip rounding drift.
            var payableMinor = order.OrderItems.Sum(i => i.LineTotalMinor - i.DiscountMinor);

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                Amount = order.TotalAmount,
                Currency = "NOK",
                PaymentMethod = chosenProvider.Name,
                Provider = chosenProvider.Name,
                ProviderReference = attemptRef,       // "{Reference}-rN"; UNIQUE
                IdempotencyKey = attemptRef,
                PromotionCodeId = order.PromotionCodeId,
                Status = PaymentStatus.Created,
                PaymentDate = now,
                AuthorizedAmountMinor = 0,
                AttemptNo = attemptNo
            };
            _db.Payments.Add(payment);

            // Fresh hold window for the new attempt (holds belong to the ORDER, design §3.5).
            order.Status = OrderStatus.Pending;
            order.HoldExpiresAt = now.AddMinutes(_opts.HoldMinutes);
            foreach (var hold in order.Holds.Where(h => h.Status == TicketHoldStatus.Active))
                hold.ExpiresAt = order.HoldExpiresAt.Value;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            // Rebuild the order summary from OrderItems (+ ticket-type names) for the payload.
            var itemTypeIds = order.OrderItems.Select(i => i.TicketTypeId).Distinct().ToList();
            var typeNames = await _db.TicketTypes
                .Where(t => itemTypeIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, t => new { t.Name, t.AdmitCount }, ct);

            long subtotalMinor = 0, vatMinor = 0;
            var summaryLines = new List<OrderLineSummary>();
            foreach (var item in order.OrderItems)
            {
                var discountedGross = item.LineTotalMinor - item.DiscountMinor;
                var net = (long)Math.Round(discountedGross / (1m + item.UnitVatRate), MidpointRounding.AwayFromZero);
                subtotalMinor += net;
                vatMinor += discountedGross - net;
                typeNames.TryGetValue(item.TicketTypeId, out var info);
                summaryLines.Add(new OrderLineSummary(
                    TicketTypeName: info?.Name ?? "Ticket",
                    Quantity: item.Quantity,
                    AdmitCount: info?.AdmitCount ?? 1,
                    UnitPriceMinor: item.UnitPriceMinor,
                    VatRate: item.UnitVatRate,
                    LineTotalMinor: discountedGross));
            }

            var summary = new OrderSummary(
                Reference: order.Reference,
                Lines: summaryLines,
                SubtotalMinor: subtotalMinor,
                VatMinor: vatMinor,
                TotalMinor: payableMinor,
                Currency: "NOK");

            InitiateResult init;
            try
            {
                init = await chosenProvider.InitiateAsync(new InitiateRequest(
                    OrderRef: attemptRef,
                    Amount: new Money(payableMinor, "NOK"),
                    ReturnUrl: _opts.CheckoutReturnUrl,
                    IdempotencyKey: attemptRef,
                    Description: $"Klubn tickets {order.Reference}",
                    CustomerEmail: order.CustomerEmail), ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Retry provider initiate failed for {AttemptRef}; payment persisted as Created for reconcile.", attemptRef);
                throw new InvalidOperationException("Could not start payment. Please try again.");
            }

            payment.ProviderPspReference = init.ProviderReference;
            payment.LastSyncedAt = now;
            await _db.SaveChangesAsync(ct);

            return new CreatePaymentResult(summary, init.RedirectUrl, chosenProvider.Name);
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
            // DB truth but is logged loudly for reconciliation. A free (zero-total) order
            // legitimately carries amount 0 — the expected/actual both compute to 0.
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

            // EXACTLY-ONCE GUARD — LAYER 1 (payment-level CAS). Two finalize paths can both
            // clear layer-0 dedup when they carry different PspRefs (e.g. a real webhook vs the
            // status-poll/sandbox synthetic ref). This atomic compare-and-swap on
            // Payment.Status is the per-attempt guard: the first transaction to flip THIS row
            // to Captured wins; a concurrent/late finalizer of the SAME attempt sees 0 rows and
            // bails. Row-level locking serializes the racers.
            var claimed = await _db.Database.ExecuteSqlInterpolatedAsync(
                $@"UPDATE ""Payments"" SET ""Status"" = {(int)PaymentStatus.Captured}
                   WHERE ""Id"" = {payment.Id} AND ""Status"" <> {(int)PaymentStatus.Captured}", ct);
            if (claimed != 1)
            {
                await tx.RollbackAsync(ct);
                _log.LogInformation("CaptureAndIssue: {Reference} already captured by another path; no-op.", order.Reference);
                return;
            }

            // EXACTLY-ONCE GUARD — LAYER 2 (order-level CAS, design §3.5). With multi-attempt
            // payments, two DIFFERENT attempts could each clear the payment-level CAS (e.g. the
            // user pays in two tabs, or a stale redirect for attempt 1 completes after attempt 2
            // succeeded). This CAS on the ORDER makes fulfillment exactly-once across ALL
            // attempts: the first to flip the order to Fulfilled issues; any other attempt sees
            // 0 rows, rolls back its issue work, and (money WAS taken) marks itself Captured,
            // logs CRITICAL, and best-effort auto-refunds.
            var orderClaimed = await _db.Database.ExecuteSqlInterpolatedAsync(
                $@"UPDATE ""Orders"" SET ""Status"" = {(int)OrderStatus.Fulfilled}
                   WHERE ""Id"" = {order.Id}
                     AND ""Status"" NOT IN ({(int)OrderStatus.Fulfilled}, {(int)OrderStatus.Refunded})", ct);
            if (orderClaimed != 1)
            {
                // Another attempt already fulfilled this order. Roll back the issue work, but
                // the money for THIS attempt was captured by the provider — record that truth,
                // refund, and CRITICAL-log via the shared loser path (design §3.5).
                await tx.RollbackAsync(ct);
                await RecordCapturedRefundAndCancelAsync(
                    payment, ev, order,
                    idemSuffix: "-dup-refund",
                    reason: $"DUPLICATE capture for order {order.Reference} (attempt {payment.ProviderReference}) — order already fulfilled by another attempt",
                    cancelOrder: false,   // the order is already Fulfilled by the winning attempt; do not touch it
                    ct);
                return;
            }

            // Commit each hold: held -> sold (atomic, never goes negative). With multi-attempt
            // payments AND the sweeper, a hold may NOT be Active by the time we capture:
            //   • the TicketHoldSweeper expired it (real prod Vipps race: user approves at 9:59,
            //     sweeper expires the hold at 10:00, captured.v1 lands at 10:01); OR
            //   • a Failed/Cancelled/Expired webhook released it, then reconcile/late-webhook
            //     drove us here anyway.
            // The OLD code did `.Where(Status == Active)` and SILENTLY SKIPPED non-Active holds,
            // issuing a ticket while QuantitySold was never incremented — a ghost ticket outside
            // inventory accounting. Fix 2: every hold MUST commit inventory or we MUST NOT issue.
            foreach (var hold in order.Holds)
            {
                if (hold.Status == TicketHoldStatus.Active)
                {
                    // Active hold: the held units are already counted in QuantityHeld; move them
                    // held -> sold atomically (never negative).
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $@"UPDATE ""TicketTypes""
                           SET ""QuantitySold"" = ""QuantitySold"" + {hold.Quantity},
                               ""QuantityHeld"" = CASE WHEN ""QuantityHeld"" >= {hold.Quantity}
                                                       THEN ""QuantityHeld"" - {hold.Quantity} ELSE 0 END
                           WHERE ""Id"" = {hold.TicketTypeId}", ct);
                    hold.Status = TicketHoldStatus.Committed;
                    continue;
                }

                // Released/Expired hold: the units are NO LONGER in QuantityHeld (the sweeper /
                // Failed-release already gave them back). Re-reserve AND commit in one atomic
                // conditional UPDATE — straight to QuantitySold (no Held leg, we commit now) —
                // gated on real availability so we can't oversell.
                var reReserved = await _db.Database.ExecuteSqlInterpolatedAsync(
                    $@"UPDATE ""TicketTypes""
                       SET ""QuantitySold"" = ""QuantitySold"" + {hold.Quantity}
                       WHERE ""Id"" = {hold.TicketTypeId}
                         AND (""Capacity"" - ""QuantitySold"" - ""QuantityHeld"") >= {hold.Quantity}", ct);

                if (reReserved == 1)
                {
                    hold.Status = TicketHoldStatus.Committed;
                    _log.LogWarning(
                        "CaptureAndIssue: capture after hold release for {Reference} (tier {TicketTypeId}, qty {Qty}); re-reserved.",
                        order.Reference, hold.TicketTypeId, hold.Quantity);
                    continue;
                }

                // 0 rows ⇒ genuinely sold out meanwhile (someone else took the inventory while
                // this hold was released). We CANNOT issue. Roll the whole issue tx back, but the
                // money WAS taken — record Captured, refund, CRITICAL-log, and Cancel the order.
                await tx.RollbackAsync(ct);

                // The rollback reverted the DB, but EF's change tracker still holds the in-memory
                // hold.Status=Committed mutations set on EARLIER loop iterations. Resync those
                // tracked holds from the (rolled-back) DB so the helper's SaveChanges persists
                // ONLY the payment/order truth, never a stale Committed hold against released
                // inventory.
                foreach (var h in order.Holds)
                    await _db.Entry(h).ReloadAsync(ct);

                await RecordCapturedRefundAndCancelAsync(
                    payment, ev, order,
                    idemSuffix: "-oversold-refund",
                    reason: $"capture for order {order.Reference} but tier {hold.TicketTypeId} (qty {hold.Quantity}) sold out while the hold was released — cannot issue",
                    cancelOrder: true,    // no winning attempt here; this order is dead — Cancel it
                    ct);
                return;
            }

            // Promo CONSUMPTION (design §3.1/§8): make the reservation permanent inside the
            // issue transaction. Reserved → Consumed. If the sweeper RACED us and already
            // Released it (§8: "Payment succeeds but promo row says Released"), re-consume it
            // and unconditionally re-increment UsageCount so the discount the customer received
            // is correctly accounted — the customer is never punished for our timing. A missing
            // redemption row never blocks issuance.
            if (order.PromotionCodeId is { } promoId)
            {
                var redemption = await _db.Set<PromoRedemption>()
                    .FirstOrDefaultAsync(rd => rd.OrderId == order.Id, ct);
                if (redemption is null)
                {
                    _log.LogWarning("CaptureAndIssue: order {Reference} has PromotionCodeId but no redemption row; continuing.", order.Reference);
                }
                else if (redemption.Status == PromoRedemptionStatus.Reserved)
                {
                    redemption.Status = PromoRedemptionStatus.Consumed;
                }
                else if (redemption.Status == PromoRedemptionStatus.Released)
                {
                    redemption.Status = PromoRedemptionStatus.Consumed;
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $@"UPDATE ""PromotionCodes"" SET ""UsageCount"" = ""UsageCount"" + 1
                           WHERE ""Id"" = {promoId}", ct);
                    _log.LogWarning("CaptureAndIssue: promo redemption for {Reference} was Released (sweeper race); re-consumed and re-incremented UsageCount.", order.Reference);
                }
            }

            // Issue one Ticket per unit; each admits AdmitCount people. Pricing reflects the
            // per-line discount: the discounted unit gross drives BasePrice/VAT/Total so the
            // ticket shows what the buyer actually paid.
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

                // Discounted per-unit gross (allocate the line discount evenly over its units).
                var discountedLineGross = item.LineTotalMinor - item.DiscountMinor;
                var unitGrossMinor = item.Quantity > 0 ? discountedLineGross / item.Quantity : discountedLineGross;
                var unitGross = unitGrossMinor / 100m;
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
            // The order-level CAS already flipped Status to Fulfilled in the DB; keep the
            // in-memory entity (loaded before the raw UPDATE) consistent so SaveChanges and any
            // later read agree.
            order.Status = OrderStatus.Fulfilled;
            order.HoldExpiresAt = null;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            _log.LogInformation("Issued tickets for order {Reference} ({Count} items).",
                order.Reference, order.OrderItems.Count);

            // Post-commit confirmation email (design §4.4) — best-effort, belt-and-braces
            // try/catch here too (the service is also exception-safe internally). A send
            // failure NEVER fails the finalize: tickets are in the wallet, the webhook 200s.
            try
            {
                await _confirmation.SendAsync(order.Id, ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "CaptureAndIssue: confirmation email send failed for {Reference} (non-fatal).", order.Reference);
            }
        }

        // Shared "the money was taken but we could NOT issue" loser path (design §3.5/§8).
        // Used by BOTH the duplicate-capture branch (another attempt won) and the oversold
        // branch (the released hold could not be re-reserved). Runs AFTER the issue tx has been
        // rolled back: records the capture as DB truth on a SEPARATE save (so it survives the
        // rollback), best-effort auto-refunds via THIS payment's provider with a deterministic
        // idemKey, and CRITICAL-logs. A refund failure stays CRITICAL-logged for the reconcile
        // runbook — it never throws out of FinalizeAsync (the webhook must still 200).
        //   cancelOrder=false: another attempt already Fulfilled this order — leave it alone.
        //   cancelOrder=true : no winning attempt — this order is dead, Cancel it.
        private async Task RecordCapturedRefundAndCancelAsync(
            Payment payment, PaymentEvent ev, Order order,
            string idemSuffix, string reason, bool cancelOrder, CancellationToken ct)
        {
            payment.Status = PaymentStatus.Captured;
            payment.CapturedAmountMinor = ev.Amount.AmountMinor;
            payment.ProviderPspReference = ev.PspRef ?? payment.ProviderPspReference;
            payment.LastSyncedAt = DateTime.UtcNow;

            if (cancelOrder && order.Status is not (OrderStatus.Fulfilled or OrderStatus.Refunded))
            {
                order.Status = OrderStatus.Cancelled;
                order.HoldExpiresAt = null;
            }

            await _db.SaveChangesAsync(ct);

            _log.LogCritical(
                "CaptureAndIssue: {Reason}; auto-refunding {Minor} {Currency} (attempt {AttemptRef}).",
                reason, ev.Amount.AmountMinor, ev.Amount.Currency, payment.ProviderReference);

            if (ev.Amount.AmountMinor > 0)
            {
                try
                {
                    var prov = _registry.Resolve(payment.Provider);
                    await prov.RefundAsync(
                        payment.ProviderReference, ev.Amount,
                        payment.ProviderReference + idemSuffix, ct);
                }
                catch (Exception ex)
                {
                    _log.LogCritical(ex,
                        "CaptureAndIssue: auto-refund FAILED for {AttemptRef} — manual reconcile required.",
                        payment.ProviderReference);
                }
            }
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

            // Release the promo reservation alongside the holds (design §3.1/§6): decrement
            // UsageCount (floor 0) and flip the redemption to Released, but ONLY when it is
            // still Reserved — never undo a Consumed redemption (that order was paid).
            await ReleasePromoReservationAsync(order, ct);

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

        // Shared promo-release used by ReleaseAsync (and reused conceptually by the sweeper,
        // which drives the SAME FinalizeAsync(Expired)→ReleaseAsync path). Decrements
        // UsageCount with a floor of 0 and flips a STILL-Reserved redemption to Released. Must
        // run inside the caller's open transaction (it issues a raw UPDATE + mutates a tracked
        // entity; the caller commits). No-op when the order has no promo or it isn't Reserved.
        private async Task ReleasePromoReservationAsync(Order order, CancellationToken ct)
        {
            if (order.PromotionCodeId is not { } promoId) return;

            var redemption = await _db.Set<PromoRedemption>()
                .FirstOrDefaultAsync(rd => rd.OrderId == order.Id, ct);
            if (redemption is null || redemption.Status != PromoRedemptionStatus.Reserved)
                return;

            await _db.Database.ExecuteSqlInterpolatedAsync(
                $@"UPDATE ""PromotionCodes""
                   SET ""UsageCount"" = CASE WHEN ""UsageCount"" > 0 THEN ""UsageCount"" - 1 ELSE 0 END
                   WHERE ""Id"" = {promoId}", ct);
            redemption.Status = PromoRedemptionStatus.Released;
        }
    }
}
