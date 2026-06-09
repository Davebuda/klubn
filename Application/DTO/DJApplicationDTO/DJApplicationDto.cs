using DJDiP.Domain.Models;

namespace DJDiP.Application.DTO.DJApplicationDTO
{
    public class DJApplicationDto
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
        public string? SocialLinks { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string? CoverImageUrl { get; set; }
        public ApplicationStatus Status { get; set; }
        public DateTime SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewedByAdminId { get; set; }
        public string? RejectionReason { get; set; }

        // User info
        public string? UserEmail { get; set; }
        public string? UserName { get; set; }
    }

    public class CreateDJApplicationDto
    {
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
    }

    public class UpdateApplicationStatusDto
    {
        public Guid ApplicationId { get; set; }
        public ApplicationStatus Status { get; set; }
        public string ReviewedByAdminId { get; set; } = string.Empty;
        public string? RejectionReason { get; set; }
    }
}
