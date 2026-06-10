namespace DJDiP.Domain.Models
{
    public class Order
    {
        public Guid Id { get; set; }
        public string UserId { get; set; }
        public ApplicationUser User { get; set; } = null!;
        public DateTime OrderDate { get; set; }
        public decimal TotalAmount { get; set; }
        public OrderStatus Status { get; set; }
        public List<OrderItem> OrderItems { get; set; } = new();
        public Payment Payment{ get; set; } = null!;

        // Ticketing/Vipps (P2-T3).
        public string Reference { get; set; } = string.Empty; // merchant order ref, e.g. "klubn-{shortid}"; UNIQUE
        public string? CustomerEmail { get; set; }            // ticket delivery target (guest or logged-in)
        public DateTime? HoldExpiresAt { get; set; }          // drives the hold sweeper (P5)
        public List<TicketHold> Holds { get; set; } = new();
}

}