namespace DJDiP.Domain.Models
{
    public class Badge
    {
        public Guid Id { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public string? IconUrl { get; set; }
        public string Category { get; set; } = "General"; // General, Social, Events, Media
        public string Rarity { get; set; } = "Common"; // Common, Rare, Epic, Legendary
        public int RequiredPoints { get; set; }
        public int? RequiredLevel { get; set; }
        public int? RequiredCount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<UserBadge> UserBadges { get; set; } = new();
    }
}
