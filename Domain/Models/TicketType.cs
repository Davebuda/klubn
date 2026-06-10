namespace DJDiP.Domain.Models
{
    // Per-tier template for an event (VIP / Gold / GA / Table-for-4 ...).
    // Each type owns its own price, VAT, capacity, admit-count and sales window.
    // Money is stored in minor units (øre) as long; decimal is used only for VATRate.
    // Architecture: docs/design/ticketing-vipps-architecture.md §2.
    public class TicketType
    {
        public Guid Id { get; set; }

        public Guid EventId { get; set; }
        public Event Event { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        // Money in minor units (øre). decimal only on VATRate.
        public long PriceMinor { get; set; }
        public decimal VATRate { get; set; } = 0.12m; // 12% VAT for event tickets in Norway
        public string Currency { get; set; } = "NOK";

        // Maintained counters (never COUNT(*)). The DB CHECK constraint
        // (QuantitySold + QuantityHeld <= Capacity) is the oversell backstop.
        public int Capacity { get; set; }
        public int QuantitySold { get; set; } = 0;
        public int QuantityHeld { get; set; } = 0;

        // 4 = Table-for-4. Snapshotted onto each issued Ticket at capture time.
        public int AdmitCount { get; set; } = 1;

        public int MinPerOrder { get; set; } = 1;
        public int MaxPerOrder { get; set; } = 10;

        public DateTime? SalesStart { get; set; }
        public DateTime? SalesEnd { get; set; }

        public TicketTypeStatus Status { get; set; } = TicketTypeStatus.Draft;
        public int SortOrder { get; set; }

        // Hidden tier (checkout-orchestration design §3.2). Visibility is orthogonal to
        // lifecycle Status: a hidden tier still moves Draft→OnSale→SoldOut. When
        // IsHidden && Status==OnSale the tier is excluded from the public ticketTypes
        // query and rejected at quote/create UNLESS the request carries a promo code
        // with UnlocksHiddenTypes whose scope (event + type list) covers this tier.
        public bool IsHidden { get; set; } = false;

        // Available = Capacity - QuantitySold - QuantityHeld (computed, not stored).
    }

    public enum TicketTypeStatus
    {
        Draft = 0,
        OnSale = 1,
        Paused = 2,
        SoldOut = 3,
        Closed = 4
    }
}
