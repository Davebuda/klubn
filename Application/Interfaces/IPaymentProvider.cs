using DJDiP.Application.DTO.PaymentDTO;

namespace DJDiP.Application.Interfaces
{
    // The single payment-provider seam (design §3, L2). Vipps is the first impl;
    // Stripe can be added later as one new class with ZERO domain changes.
    // Domain & orchestration never see provider specifics — only Money / PaymentEvent
    // and the neutral DTOs in Application.DTO.PaymentDTO. No provider/Vipps types may
    // appear in any signature here.
    public interface IPaymentProvider
    {
        // "Vipps" | "Stripe". Used to dispatch the {provider} webhook route segment.
        string Name { get; }

        // Persist Reference + Payment(Created) BEFORE calling this — initiate is NOT
        // idempotent for some providers; on timeout recover via GetStatusAsync, never re-initiate.
        Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct);

        // Poll fallback / reconcile (e.g. GET /epayment/v1/payments/{ref}).
        Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct);

        // Capture/refund take a deterministic Idempotency-Key so retries don't double-charge.
        Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct);
        Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct);
        Task CancelAsync(string providerRef, CancellationToken ct);

        // ALWAYS call VerifyWebhookSignature before NormalizeWebhook. Verification is
        // constant-time (reuse the FixedTimeEquals approach from IngestController.SecretValid).
        bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers);
        PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers);
    }
}
