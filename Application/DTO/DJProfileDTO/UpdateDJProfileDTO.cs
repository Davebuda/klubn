namespace DJDiP.Application.DTO.DJProfileDTO
{
    public class UpdateDJProfileDto
    {
        public Guid Id { get; set; } // viktig for å identifisere hvilken profil som skal endres
        public string StageName { get; set; } = string.Empty;
        public string? FullName { get; set; }
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
        public List<string>? TopTracks { get; set; }
    }
}
