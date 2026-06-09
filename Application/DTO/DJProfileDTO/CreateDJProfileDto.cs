namespace DJDiP.Application.DTO.DJProfileDTO
{
    public class CreateDJProfileDto
    {
        public string StageName { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string Bio { get; set; } = string.Empty;
        public string? LongBio { get; set; }
        public string? Tagline { get; set; }
        public string Genre { get; set; } = string.Empty;
        public string SocialLinks { get; set; } = string.Empty;
        public string ProfilePictureUrl { get; set; } = string.Empty;
        public string? CoverImageUrl { get; set; }
        public string? Specialties { get; set; }
        public string? Achievements { get; set; }
        public int? YearsExperience { get; set; }
        public string? InfluencedBy { get; set; }
        public string? EquipmentUsed { get; set; }
        public string UserId { get; set; } = string.Empty;
        public List<string>? TopTracks { get; set; }
    }
}
