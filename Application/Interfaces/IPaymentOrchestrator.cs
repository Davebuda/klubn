using DJDiP.Application.DTO.PaymentDTO;

namespace DJDiP.Application.Interfaces
{
    // Orchestration boundary (design §3/§6). Implementation deferred to P5.
    //
    // Ordering invariant (MUST hold): the orchestrator persists Order +
    // Payment(Created) + Reference BEFORE calling IPaymentProvider.InitiateAsync,
    // then holds inventory, then initiates. On the inbound path it ALWAYS calls
    // IPaymentProvider.VerifyWebhookSignature before NormalizeWebhook.
    public interface IPaymentOrchestrator
    {
        // Checkout: resolve prices from TicketType (never client amounts), persist
        // Reference + Payment(Created) first, hold inventory (oversell-safe), then
        // InitiateAsync. Returns the §6 resolved summary + provider redirectUrl.
        Task<CreatePaymentResult> CreatePaymentAsync(
            Guid eventId,
            IReadOnlyList<OrderLineRequest> lines,
            string? customerEmail,
            string? actingUserId,
            CancellationToken ct);

        // Shared idempotent finalize/reconcile path consumed by BOTH the webhook (P6)
        // and the paymentStatus poll (P5): drives the capture→issue state machine
        // exactly once. Idempotent under webhook+poll races and duplicate deliveries.
        Task FinalizeAsync(PaymentEvent paymentEvent, CancellationToken ct);
    }
}
