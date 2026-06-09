namespace DJDiP.Application.DTO.TicketDTO
{
    public class TicketDto
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string TicketNumber { get; set; } = string.Empty;
        public string QRCode { get; set; } = string.Empty;

        // Pricing with VAT breakdown
        public decimal BasePrice { get; set; }
        public decimal VATRate { get; set; }
        public decimal VATAmount { get; set; }
        public decimal TotalPrice { get; set; }

        // Status
        public bool IsValid { get; set; }
        public bool IsCheckedIn { get; set; }
        public string Status { get; set; } = string.Empty;

        // Dates
        public DateTime PurchaseDate { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CancelledDate { get; set; }
        public DateTime? RefundedDate { get; set; }

        // Compliance
        public bool TermsAccepted { get; set; }
        public DateTime? TermsAcceptedDate { get; set; }

        // Transfer info
        public string? TransferredFromUserId { get; set; }
        public DateTime? TransferredDate { get; set; }

        public TicketEventDto Event { get; set; } = new();
    }

    public class TicketEventDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string VenueName { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
    }
}
