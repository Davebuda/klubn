namespace DJDiP.Application.DTO.PaymentDTO
{
    // Stateless checkout quote (checkout-orchestration design §4.2). Validates a
    // selection EXACTLY like create (status, window, hidden-unlock, min/max, live
    // availability) and prices it (incl. promo) WITHOUT any side effect. The totals
    // are advisory for display — create re-validates and re-prices from the DB, so a
    // quote is NEVER trusted as an input to create.
    //
    // Money is in minor units (øre) as long; VatRate is the only decimal. Property
    // casing is deliberate so HotChocolate's camelCase fields match the FE contract
    // (e.g. VatRate -> "vatRate", NOT the model's VATRate -> "vATRate").

    // ----- input -----
    public sealed record CheckoutSelectionLine(Guid TicketTypeId, int Quantity);

    public sealed record CheckoutSelection(
        Guid EventId,
        IReadOnlyList<CheckoutSelectionLine> Lines,
        string? PromoCode);

    // ----- output -----
    public sealed record CheckoutQuoteLine(
        Guid TicketTypeId,
        string Name,
        int Quantity,
        long UnitPriceMinor,
        decimal VatRate,
        long LineGrossMinor,      // Quantity * UnitPriceMinor (VAT-inclusive)
        long DiscountMinor,       // promo allocation for this line
        long LineTotalMinor);     // LineGrossMinor - DiscountMinor

    // The promo sub-object: an invalid promo NEVER fails the quote (design §5) —
    // it returns Ok=false + Reason and totals WITHOUT the discount.
    public sealed record CheckoutQuotePromo(
        string Code,
        bool Ok,
        string? Reason);

    public sealed record CheckoutQuote(
        bool Ok,                  // false when the SELECTION itself is invalid (sold out / not on sale / hidden)
        string? Reason,           // selection-level failure reason (null when Ok)
        IReadOnlyList<CheckoutQuoteLine> Lines,
        long SubtotalMinor,       // sum of per-line net (after discount)
        long DiscountMinor,       // total discount
        long VatMinor,            // sum of per-line VAT (on discounted gross)
        long TotalMinor,          // sum of per-line LineTotalMinor (= Subtotal + Vat)
        string Currency,
        CheckoutQuotePromo? Promo,           // null when no promo code supplied
        IReadOnlyList<string> AvailableProviders)
    {
        // A structurally-failed quote (bad selection) with no priced lines.
        public static CheckoutQuote Failed(string reason, string currency, IReadOnlyList<string> providers) =>
            new(false, reason, Array.Empty<CheckoutQuoteLine>(), 0, 0, 0, 0, currency, null, providers);
    }
}
