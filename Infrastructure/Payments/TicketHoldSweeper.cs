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
    // SAFETY RULE: only orders whose payment is still Created are swept. An Authorized
    // payment means the buyer's money is reserved and a capture may be in flight (the
    // return-page reconcile or, later, the P6 webhook) — sweeping those would race the
    // capture. Expiry of authorized-but-never-captured payments is a P6/reconciliation
    // concern, not the sweeper's.
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

            // Candidates: order still Pending, hold window past, and the payment never
            // progressed beyond Created (buyer abandoned before/at the provider page).
            var references = await (
                from o in db.Orders
                join p in db.Payments on o.Id equals p.OrderId
                where o.Status == OrderStatus.Pending
                      && o.HoldExpiresAt != null
                      && o.HoldExpiresAt < cutoff
                      && p.Status == PaymentStatus.Created
                      && p.ProviderReference != null
                select p.ProviderReference!)
                .Take(50) // bounded batch per tick; the next tick takes the rest
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
