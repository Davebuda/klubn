namespace DJDiP.Domain.Models
{
    public class UserBadge
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public Guid BadgeId { get; set; }
        public bool IsDisplayed { get; set; } = true;
        public DateTime EarnedAt { get; set; } = DateTime.UtcNow;

        public ApplicationUser User { get; set; } = null!;
        public Badge Badge { get; set; } = null!;
    }
}
