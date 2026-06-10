namespace DJDiP.Application.DTO.PaymentDTO
{
    // Result of IPromoCodeService.ValidateAsync (checkout-orchestration design §4.1).
    // The service throws NOTHING — every failure is surfaced as Ok=false + a
    // user-displayable Reason so the quote can render inline feedback. Money is in
    // minor units (øre) as long; the service computes discount only, never VAT
    // (the quote service applies VAT on the discounted gross).
    public sealed record PromoLineDiscount(Guid TicketTypeId, long DiscountMinor);

    public sealed record PromoValidationResult
    {
        public bool Ok { get; init; }

        // User-displayable reason when Ok=false, e.g. "This code has expired." Null on success.
        public string? Reason { get; init; }

        public Guid? PromoCodeId { get; init; }

        // The normalized (uppercase) code that was looked up.
        public string Code { get; init; } = string.Empty;

        // Total discount across all eligible lines, minor units.
        public long DiscountMinor { get; init; }

        // Per-line allocation (largest-remainder) — sums exactly to DiscountMinor.
        public IReadOnlyList<PromoLineDiscount> PerLineDiscounts { get; init; } = Array.Empty<PromoLineDiscount>();

        // Hidden ticket types this code unlocks (empty unless UnlocksHiddenTypes).
        public IReadOnlyList<Guid> UnlockedTicketTypeIds { get; init; } = Array.Empty<Guid>();

        public static PromoValidationResult Fail(string code, string reason) =>
            new() { Ok = false, Code = code, Reason = reason };
    }

    // A resolved checkout line handed to the promo validator by the caller (quote
    // service / orchestrator). Carries the price/VAT data the validator needs so the
    // validation+math core stays pure and DB-free. Money in minor units (øre).
    public sealed record PromoLine(
        Guid TicketTypeId,
        int Quantity,
        long UnitPriceMinor,
        decimal VatRate,
        bool IsHidden);
}
