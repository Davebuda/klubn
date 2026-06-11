namespace DJDiP.Application.DTO.PaymentDTO
{
    // GraphQL-facing checkout DTOs. Property casing is deliberate so HotChocolate's
    // camelCase fields match the pinned frontend contract exactly (e.g. VatRate ->
    // "vatRate", NOT the model's VATRate -> "vATRate").

    // Read model for one ticket tier with live availability (query: ticketTypes).
    public sealed class TicketTypeAvailabilityDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public long PriceMinor { get; set; }
        public decimal VatRate { get; set; }
        public string Currency { get; set; } = "NOK";
        public int AdmitCount { get; set; }
        public int MinPerOrder { get; set; }
        public int MaxPerOrder { get; set; }
        public int Available { get; set; }
        public string Status { get; set; } = string.Empty;
        public int SortOrder { get; set; }

        // True only for a hidden tier surfaced via an unlockCode (hidden-tier reveal,
        // design §3.2). Public tiers are always false. The FE uses this to render the
        // "Unlocked" marker; it carries no purchasability meaning of its own (the tier
        // is OnSale and quotable exactly when the same code is applied at quote/create).
        public bool IsUnlocked { get; set; }
    }

    // ----- createTicketOrder input -----
    public sealed record OrderLineInput(Guid TicketTypeId, int Quantity);

    // PromoCode/Provider are APPENDED optionals (C5): old clients that omit them get the
    // pre-C5 behaviour exactly (no discount, default provider). HotChocolate maps Guid as
    // UUID! and these as nullable String.
    public sealed record CreateTicketOrderInput(
        Guid EventId,
        List<OrderLineInput> Lines,
        string? CustomerEmail,
        string? PromoCode = null,
        string? Provider = null);

    // ----- quoteTicketOrder input (C5; stateless quote — design §4.2/§5) -----
    // Anonymous-allowed: a logged-out shopper can price a selection. Guid -> UUID!.
    public sealed record QuoteTicketOrderInput(
        Guid EventId,
        List<OrderLineInput> Lines,
        string? PromoCode = null);

    // createTicketOrder payload: the resolved order summary + off-site redirect + the
    // active provider name (so the UI can label "Pay with {provider}").
    public sealed record CreateTicketOrderPayload(
        OrderSummary Order,
        string RedirectUrl,
        string Provider);

    // ticketOrder / completeSandboxPayment status.
    public sealed record TicketOrderStatusDto(
        string Reference,
        string Status,
        string PaymentState,
        long TotalMinor,
        string Currency);
}
