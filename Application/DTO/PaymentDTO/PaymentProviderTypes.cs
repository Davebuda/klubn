namespace DJDiP.Application.DTO.PaymentDTO
{
    // Provider-neutral value types for the IPaymentProvider seam (design §3).
    // NEVER use decimal for money here — money is minor units (øre) as long.
    // No Vipps/Stripe-specific shapes may appear in these types.

    // Money value object. AmountMinor is minor units (øre for NOK).
    public readonly record struct Money(long AmountMinor, string Currency)
    {
        public static Money Nok(long amountMinor) => new(amountMinor, "NOK");
    }

    // Normalized payment lifecycle event emitted from a verified webhook
    // (or a status poll). Domain logic consumes only this — never raw provider payloads.
    public enum PaymentEventType
    {
        Authorized = 0,
        Captured = 1,
        Refunded = 2,
        Failed = 3,
        Expired = 4,
        Cancelled = 5
    }

    public sealed record PaymentEvent(
        string OrderRef,            // == Order.Reference / Payment.ProviderReference
        string? PspRef,             // provider PSP reference
        PaymentEventType Type,
        Money Amount,
        DateTime OccurredAt,
        string RawPayload);         // retained for audit; never logged with PII (GDPR §8.4)

    // ----- Request/result DTOs (all provider-neutral) -----

    // Persist Reference + Payment(Created) BEFORE calling InitiateAsync (initiate is
    // not idempotent for some providers). ReturnUrl is where the provider redirects back.
    public sealed record InitiateRequest(
        string OrderRef,
        Money Amount,
        string ReturnUrl,
        string IdempotencyKey,
        string? Description = null,
        string? CustomerEmail = null);

    public sealed record InitiateResult(
        string ProviderReference,
        string RedirectUrl);

    // Snapshot of provider-side payment state (poll fallback / reconcile).
    public sealed record PaymentSnapshot(
        string ProviderReference,
        string? PspRef,
        PaymentEventType State,
        Money AuthorizedAmount,
        Money CapturedAmount,
        Money RefundedAmount,
        DateTime ObservedAt);

    public sealed record CaptureResult(
        string PspRef,
        Money CapturedAmount);

    public sealed record RefundResult(
        string RefundRef,
        Money RefundedAmount);
}
