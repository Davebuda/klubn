namespace DJDiP.Application.DTO.DJProfileDTO
{
    public class DJProfileDetailDto
    {
        public Guid Id { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string? LongBio { get; set; }
        public string Genre { get; set; } = string.Empty;
        public List<SocialLinkDto> SocialLinks { get; set; } = new();
        public string ProfilePictureUrl { get; set; } = string.Empty;
        public string? CoverImageUrl { get; set; }
        public string? Tagline { get; set; }
        public string? Specialties { get; set; }
        public string? Achievements { get; set; }
        public int? YearsExperience { get; set; }
        public string? InfluencedBy { get; set; }
        public string? EquipmentUsed { get; set; }
        public List<string> TopTracks { get; set; } = new();
        public List<Guid> GenreIds { get; set; } = new();
        public int FollowerCount { get; set; }
        public List<DJProfileEventSummaryDto> UpcomingEvents { get; set; } = new();
    }
}
