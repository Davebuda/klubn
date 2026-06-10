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
        //
        // promoCode (C4, design §3.1/§4.1): null/blank ⇒ no discount. A NON-null code is
        // validated AFTER resolving the lines; an INVALID code is a HARD error here
        // (InvalidOperationException with the validator's Reason) — unlike quote, create
        // never silently drops a discount. A valid code reserves one usage atomically
        // (UsageCount CAS) inside the inventory transaction and may unlock IsHidden tiers.
        //
        // provider (C4, design §4.3): null ⇒ registry.DefaultProvider; otherwise the name
        // is checked against registry.IsEnabled FIRST (before any state is created) and an
        // unknown/disabled name throws InvalidOperationException("Unknown payment provider.").
        // The chosen provider is stamped on the Payment row so every later step resolves it
        // from the row, never global config. A 100%-discount (zero-total) order is legal:
        // InitiateAsync is skipped and the order finalizes through the SAME FinalizeAsync
        // path via a synthesized free-capture event.
        Task<CreatePaymentResult> CreatePaymentAsync(
            Guid eventId,
            IReadOnlyList<OrderLineRequest> lines,
            string? customerEmail,
            string? actingUserId,
            string? promoCode,
            string? provider,
            CancellationToken ct);

        // Retry payment for an unpaid order (C4, design §3.5/§6). Owner-checked; rejected
        // if any attempt is Captured or the order is Paid/Fulfilled/Refunded. Best-effort
        // cancels the latest non-terminal attempt, re-reserves any released holds AND the
        // promo reservation (hard error if either is no longer available — totals were
        // computed with the discount), then creates a NEW Payment row (AttemptNo = max+1,
        // ProviderReference = "{Reference}-r{N}") BEFORE InitiateAsync. provider: null ⇒
        // default; otherwise IsEnabled-checked. Returns the same CreatePaymentResult shape.
        Task<CreatePaymentResult> RetryPaymentAsync(
            string reference,
            string? provider,
            string actingUserId,
            CancellationToken ct);

        // Shared idempotent finalize/reconcile path consumed by BOTH the webhook (P6)
        // and the paymentStatus poll (P5): drives the capture→issue state machine
        // exactly once. Idempotent under webhook+poll races and duplicate deliveries.
        //
        // viaProvider (C3, design §8): the provider whose route/secret the event arrived
        // through. The webhook controller passes the resolved route-segment name; poll
        // paths (reconcile, sweeper, sandbox completion) pass null. When non-null and it
        // does NOT match the located Payment.Provider (case-insensitive), the event is a
        // cross-provider misdelivery (e.g. a stale Vipps redirect hitting /stripe) — it is
        // WARN-logged and ignored, never processed. The authoritative provider for any
        // capture/refund is always Payment.Provider, never global config.
        Task FinalizeAsync(PaymentEvent paymentEvent, CancellationToken ct, string? viaProvider = null);
    }
}
