namespace DJDiP.Domain.Models
{
    public class EventOrganizerApplication
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string OrganizationName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Website { get; set; }
        public string? SocialLinks { get; set; } // JSON string

        public ApplicationStatus Status { get; set; } = ApplicationStatus.Pending;
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewedByAdminId { get; set; }
        public string? RejectionReason { get; set; }

        public ApplicationUser User { get; set; } = null!;
    }
}
