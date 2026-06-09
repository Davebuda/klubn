namespace DJDiP.Domain.Models
{
    public class UserFollowDJ
    {
        public string UserId { get; set; } = string.Empty;
        public Guid DJId { get; set; }
        public bool NotificationsEnabled { get; set; } = true;
        public DateTime FollowedAt { get; set; } = DateTime.UtcNow;

        public ApplicationUser User { get; set; } = null!;
        public DJProfile DJ { get; set; } = null!;
    }
}
