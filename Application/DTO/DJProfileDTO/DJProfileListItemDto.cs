namespace DJDiP.Application.DTO.DJProfileDTO
{
    public class DJProfileListItemDto
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string StageName { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string Genre { get; set; } = string.Empty;
        public string ProfilePictureUrl { get; set; } = string.Empty;
        public string? Tagline { get; set; }
        public string? CoverImageUrl { get; set; }
        public int FollowerCount { get; set; }
        public double AverageRating { get; set; }
        public int ReviewCount { get; set; }
        public string? Specialties { get; set; }
        public string? Achievements { get; set; }
        public int? YearsExperience { get; set; }
        public string? InfluencedBy { get; set; }
        public List<DJProfileEventSummaryDto> UpcomingEvents { get; set; } = new();
    }
}
