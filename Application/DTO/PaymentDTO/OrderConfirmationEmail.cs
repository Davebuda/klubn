namespace DJDiP.Application.DTO.PaymentDTO
{
    // Itemized order-confirmation email payload (checkout-orchestration design §4.4).
    // Built by IOrderConfirmationService from the finalized order and handed to
    // IEmailService.SendOrderConfirmationAsync, which composes the message in the shared
    // KlubN layout. Money is in minor units (øre) as long.
    public sealed record OrderConfirmationLine(
        string Name,
        int Quantity,
        long LineTotalMinor);   // discounted line total (what the buyer paid for the line)

    public sealed record OrderConfirmationEmail(
        string ToEmail,
        string ToName,
        string Reference,
        string EventTitle,
        DateTime EventDate,
        string VenueName,
        string VenueCity,
        IReadOnlyList<OrderConfirmationLine> Lines,
        string? PromoCode,         // null when no promo applied
        long DiscountMinor,        // total discount (0 when none)
        long TotalMinor,           // final amount paid
        string Currency,
        string TicketsUrl);        // wallet link, e.g. "{FrontendUrl}/tickets"
}
