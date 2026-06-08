namespace DJDiP.Application.DTO.PaymentDTO
{
    // Resolved order summary returned by checkout (design §6, L7) — the buyer
    // never sees a bare provider screen without these line items. Money is minor
    // units (øre) as long; VAT rate is the only decimal.

    public sealed record OrderLineSummary(
        string TicketTypeName,
        int Quantity,
        int AdmitCount,
        long UnitPriceMinor,
        decimal VatRate,
        long LineTotalMinor);

    public sealed record OrderSummary(
        string Reference,
        IReadOnlyList<OrderLineSummary> Lines,
        long SubtotalMinor,
        long VatMinor,
        long TotalMinor,
        string Currency);

    // createTicketOrder return shape (design §6).
    public sealed record CreatePaymentResult(
        OrderSummary Order,
        string RedirectUrl);

    // A line requested at checkout (server resolves price from TicketType, never client).
    public sealed record OrderLineRequest(
        Guid TicketTypeId,
        int Quantity);
}
