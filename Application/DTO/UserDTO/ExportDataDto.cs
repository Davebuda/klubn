namespace DJDiP.Application.DTO.UserDTO
{
    // P0-WS3C (GDPR Art. 15/20) — self-service data export. The shape is OWNER-SCOPED: it is
    // only ever built for the caller's own id (the resolver passes the JWT id; there is no
    // path to request another user's id). Fields are post-anonymization-safe (no password
    // hashes, no reset/verification tokens, no QR door tokens).
    public class ExportDataDto
    {
        public ExportProfileDto Profile { get; set; } = new();
        public List<ExportTicketDto> Tickets { get; set; } = new();
        public List<ExportOrderDto> Orders { get; set; } = new();
    }

    public class ExportProfileDto
    {
        public string Id { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsEmailVerified { get; set; }
        public System.DateTime CreatedAt { get; set; }
        public System.DateTime? TermsAcceptedAt { get; set; }
        public string? TermsVersion { get; set; }
        public bool MarketingOptIn { get; set; }
        public System.DateTime? MarketingOptInAt { get; set; }
        public string? MarketingPurpose { get; set; }
    }

    public class ExportTicketDto
    {
        public System.Guid Id { get; set; }
        public System.Guid EventId { get; set; }
        public string TicketNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal TotalPrice { get; set; }
        public System.DateTime PurchaseDate { get; set; }
    }

    public class ExportOrderDto
    {
        public System.Guid Id { get; set; }
        public string Reference { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public string? PromoCode { get; set; }
        public System.DateTime OrderDate { get; set; }
    }
}
