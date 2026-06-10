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

        // Multi-attempt payments (checkout-orchestration design §3.4): Order is now
        // 1→N Payments (was 1:1). Readers that want the current attempt take the one
        // with the highest AttemptNo. Today there is exactly one Payment per order
        // (single-attempt), so "latest attempt" == the sole payment.
        public List<Payment> Payments { get; set; } = new();

        // Ticketing/Vipps (P2-T3).
        public string Reference { get; set; } = string.Empty; // merchant order ref, e.g. "klubn-{shortid}"; UNIQUE
        public string? CustomerEmail { get; set; }            // ticket delivery target (guest or logged-in)
        public DateTime? HoldExpiresAt { get; set; }          // drives the hold sweeper (P5)
        public List<TicketHold> Holds { get; set; } = new();

        // Promo discount snapshot (checkout-orchestration design §3.3). TotalAmount stays
        // the FINAL (discounted) total; DiscountMinor is the order-level discount in minor
        // units (øre), allocated per line onto OrderItem.DiscountMinor. PromoCode is a
        // display snapshot of the code applied.
        public Guid? PromotionCodeId { get; set; }
        public string? PromoCode { get; set; }
        public long DiscountMinor { get; set; } = 0;
}

}