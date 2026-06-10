namespace DJDiP.Domain.Models
{
    // Short-lived inventory reservation taken during checkout (default now+10min).
    // Released back to TicketType.QuantityHeld on success (→committed/sold), on
    // expiry (swept by a background IHostedService, P5), or on hard failure.
    // Architecture: docs/design/ticketing-vipps-architecture.md §2.
    public class TicketHold
    {
        public Guid Id { get; set; }

        public Guid OrderId { get; set; }
        public Order Order { get; set; } = null!;

        public Guid TicketTypeId { get; set; }
        public TicketType TicketType { get; set; } = null!;

        public int Quantity { get; set; }
        public DateTime ExpiresAt { get; set; }
        public TicketHoldStatus Status { get; set; } = TicketHoldStatus.Active;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum TicketHoldStatus
    {
        Active = 0,
        Committed = 1,
        Released = 2,
        Expired = 3
    }
}
