namespace DJDiP.Domain.Models
{
    public class Ticket
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public string UserId { get; set; }
        public string TicketNumber { get; set; } = Guid.NewGuid().ToString();
        // QRCode repurposed (P2-T5): now stores the SIGNED token id / nonce (see P7),
        // not a bare Guid. The unique index on QRCode is retained.
        public string QRCode { get; set; } = Guid.NewGuid().ToString();

        // Ticketing/Vipps links + admit-count (P2-T5).
        public Guid? OrderItemId { get; set; }       // FK→OrderItem (issuance source)
        public OrderItem? OrderItem { get; set; }
        public Guid? TicketTypeId { get; set; }      // FK→TicketType (tier)
        public TicketType? TicketType { get; set; }
        public int AdmitCount { get; set; } = 1;     // snapshot from TicketType
        public int AdmitsRemaining { get; set; }     // = AdmitCount at issue; decremented on partial entry
        public DateTime? RedeemedAt { get; set; }    // first successful scan

        // Pricing (Norwegian VAT compliance - 12% for events)
        public decimal BasePrice { get; set; }
        public decimal VATRate { get; set; } = 0.12m; // 12% VAT for event tickets in Norway
        public decimal VATAmount { get; set; }
        public decimal TotalPrice { get; set; }

        // Status
        public bool IsValid { get; set; } = true;
        public bool IsUsed { get; set; } = false;
        public TicketStatus Status { get; set; } = TicketStatus.Active;

        // Dates
        public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
        public DateTime? CheckInTime { get; set; }
        public DateTime? CancelledDate { get; set; }
        public DateTime? RefundedDate { get; set; }

        // Norwegian Consumer Rights Compliance
        public bool TermsAccepted { get; set; } = false;
        public DateTime? TermsAcceptedDate { get; set; }
        public string? CancellationReason { get; set; }
        public string? RefundTransactionId { get; set; }

        // Transfer functionality
        public string? TransferredFromUserId { get; set; }
        public DateTime? TransferredDate { get; set; }

        // Booking confirmation
        public string? ConfirmationEmailSentTo { get; set; }
        public DateTime? ConfirmationEmailSentDate { get; set; }

        // Navigation Properties
        public Event Event { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }

    public enum TicketStatus
    {
        Active = 0,
        Used = 1,
        Cancelled = 2,
        Refunded = 3,
        Expired = 4,
        Transferred = 5
    }
}