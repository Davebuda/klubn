namespace DJDiP.Domain.Models
{
    public class OrderItem
    {
        public Guid Id { get; set; }
        public Guid OrderId { get; set; }
        public Order Order { get; set; } = null!;
        public Guid EventId { get; set; }          // denormalized convenience
        public Event Event { get; set; } = null!;
        public int Quantity { get; set; }

        // Ticketing/Vipps (P2-T2): snapshot the chosen tier + minor-unit money.
        public Guid TicketTypeId { get; set; }      // which tier
        public TicketType TicketType { get; set; } = null!;

        // Money in minor units (øre). UnitPrice (decimal) migrated → UnitPriceMinor (long).
        public long UnitPriceMinor { get; set; }    // snapshot of tier price at purchase
        public decimal UnitVatRate { get; set; }    // snapshot at purchase
        public long LineTotalMinor { get; set; }    // Quantity × UnitPriceMinor (gross)

        // Per-line promo discount in minor units (øre), allocated via largest-remainder
        // so the per-line parts sum exactly to Order.DiscountMinor. VAT is computed on the
        // DISCOUNTED gross per line so per-line VAT reporting stays correct (design §3.3/§4.1).
        public long DiscountMinor { get; set; } = 0;
    }
}
