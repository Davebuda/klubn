namespace DJDiP.Domain.Models
{
    public class DJApplication
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string Genre { get; set; } = string.Empty;
        public int YearsExperience { get; set; }
        public string? Specialties { get; set; }
        public string? InfluencedBy { get; set; }
        public string? EquipmentUsed { get; set; }
        public string? SocialLinks { get; set; } // JSON string
        public string? ProfileImageUrl { get; set; }
        public string? CoverImageUrl { get; set; }

        // Application status
        public ApplicationStatus Status { get; set; } = ApplicationStatus.Pending;
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewedByAdminId { get; set; }
        public string? RejectionReason { get; set; }

        // Navigation
        public ApplicationUser User { get; set; } = null!;
    }

    public enum ApplicationStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2
    }
}
