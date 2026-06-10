using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using DJDiP.Infrastructure.Persistance;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DJDiP.Infrastructure.Payments
{
    // The hold sweeper the design mandates (architecture §2: TicketHold is "released on
    // success (→Sold) or expiry. Swept by a background IHostedService"). Without it,
    // abandoned checkouts leak QuantityHeld forever and tiers read as sold out — hit
    // live on 2026-06-10 during the first Vipps TEST run.
    //
    // SAFETY RULE: only orders where NO payment attempt has progressed beyond Created are
    // swept. An Authorized (or Captured) attempt means the buyer's money is reserved and a
    // capture may be in flight (the return-page reconcile or the webhook) — sweeping those
    // would race the capture. With multi-attempt payments (C4, design §3.4) an order can have
    // several Payment rows; the sweepable predicate is "the order has at least one Created
    // attempt AND none beyond Created" — checked per order, not per single joined payment.
    // Expiry of authorized-but-never-captured payments is a reconciliation concern.
    //
    // C4 (design §6): the sweep drives FinalizeAsync(Expired) → ReleaseAsync, which now ALSO
    // releases the promo reservation (decrement UsageCount floor 0, redemption → Released)
    // alongside the inventory holds — no extra work here; passing a Created attempt's
    // reference is sufficient.
    //
    // The sweep drives the SAME idempotent FinalizeAsync(Expired) path as webhooks and
    // reconcile, so a concurrent real webhook/poll can never double-process: layer-1
    // dedup + the CAS guard in the orchestrator stand in front of every state change.
    public sealed class TicketHoldSweeper : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly TicketingOptions _opts;
        private readonly ILogger<TicketHoldSweeper> _log;

        public TicketHoldSweeper(
            IServiceScopeFactory scopes,
            IOptions<TicketingOptions> opts,
            ILogger<TicketHoldSweeper> log)
        {
            _scopes = scopes;
            _opts = opts.Value;
            _log = log;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            // Let startup (migrations + seed, Program.cs:220) finish first.
            try { await Task.Delay(TimeSpan.FromSeconds(15), ct); }
            catch (OperationCanceledException) { return; }

            _log.LogInformation(
                "TicketHoldSweeper running: every {Interval}s, grace {Grace}min past HoldExpiresAt.",
                _opts.SweepIntervalSeconds, _opts.SweepGraceMinutes);

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    await SweepOnceAsync(ct);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    // Never let one bad sweep kill the loop — next tick retries.
                    _log.LogError(ex, "Hold sweep failed; retrying next tick.");
                }

                try { await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, _opts.SweepIntervalSeconds)), ct); }
                catch (OperationCanceledException) { return; }
            }
        }

        internal async Task SweepOnceAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var orchestrator = scope.ServiceProvider.GetRequiredService<IPaymentOrchestrator>();

            var cutoff = DateTime.UtcNow.AddMinutes(-_opts.SweepGraceMinutes);

            // Candidates: order still Pending, hold window past, and NO attempt has progressed
            // beyond Created (buyer abandoned before/at the provider page). Multi-attempt-safe:
            // the order must have at least one Created attempt AND zero attempts in any other
            // status. We pick one Created attempt's reference to drive the release path.
            var createdStatus = PaymentStatus.Created;
            var sweepableOrderIds = await (
                from o in db.Orders
                where o.Status == OrderStatus.Pending
                      && o.HoldExpiresAt != null
                      && o.HoldExpiresAt < cutoff
                      && o.Payments.Any(p => p.Status == createdStatus)
                      && o.Payments.All(p => p.Status == createdStatus)
                orderby o.HoldExpiresAt   // oldest-expired first; deterministic batch boundary
                select o.Id)
                .Take(50) // bounded batch per tick; the next tick takes the rest
                .ToListAsync(ct);

            var references = await db.Payments
                .Where(p => sweepableOrderIds.Contains(p.OrderId)
                            && p.Status == createdStatus
                            && p.ProviderReference != null)
                .GroupBy(p => p.OrderId)
                .Select(g => g.Min(p => p.ProviderReference!)) // one deterministic ref per order
                .ToListAsync(ct);

            foreach (var reference in references)
            {
                // Same normalized event a provider "expired" webhook would carry; the
                // orchestrator releases holds atomically and marks order/payment Expired.
                await orchestrator.FinalizeAsync(new PaymentEvent(
                    OrderRef: reference,
                    PspRef: null,
                    Type: PaymentEventType.Expired,
                    Amount: new Money(0, "NOK"),
                    OccurredAt: DateTime.UtcNow,
                    RawPayload: "{\"source\":\"hold-sweeper\"}"), ct);
            }

            if (references.Count > 0)
                _log.LogInformation("Hold sweeper expired {Count} abandoned order(s).", references.Count);
        }
    }
}
