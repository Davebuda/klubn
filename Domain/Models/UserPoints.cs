namespace DJDiP.Domain.Models
{
    public class UserPoints
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int TotalPoints { get; set; }
        public int CurrentLevelPoints { get; set; }
        public int Level { get; set; } = 1;
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        public ApplicationUser User { get; set; } = null!;
    }
}
