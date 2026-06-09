namespace DJDiP.Domain.Models
{
    public class DJProfile
    {
        public Guid Id { get; set; }

        // Owner/User Link (CRITICAL: Links DJ profile to ApplicationUser)
        public required string UserId { get; set; }
        public ApplicationUser? User { get; set; }

        // Basic Info
        public required string Name { get; set; }
        public string? StageName { get; set; }
        public required string Bio { get; set; }
        public string? LongBio { get; set; }
        public string? Tagline { get; set; }

        // Profile Details
        public string? ProfilePictureUrl { get; set; }
        public string? CoverImageUrl { get; set; }
        public string? Specialties { get; set; }
        public string? Achievements { get; set; }
        public int? YearsExperience { get; set; }
        public string? InfluencedBy { get; set; }
        public string? EquipmentUsed { get; set; }
        public string? Genre { get; set; }

        // Top 10 Songs (JSON string array)
        public string? Top10SongTitles { get; set; }

        // Legacy social links (JSON)
        public string? SocialLinks { get; set; }

        // Timestamps
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        public List<Genre> Genres { get; set; } = new();
        public List<DJTop10> DJTop10s { get; set; } = new();
        public List<Event> Events { get; set; } = new();
        public List<EventDJ> EventDJs { get; set; } = new();
        public List<UserFollowDJ> Followers { get; set; } = new();
        public List<DJReview> Reviews { get; set; } = new();
        public SocialMediaLinks? SocialMedia { get; set; }
    }
}