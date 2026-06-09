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
    }

    // ----- createTicketOrder input -----
    public sealed record OrderLineInput(Guid TicketTypeId, int Quantity);

    public sealed record CreateTicketOrderInput(
        Guid EventId,
        List<OrderLineInput> Lines,
        string? CustomerEmail);

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
