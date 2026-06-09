namespace DJDiP.Domain.Models
{
    public class MediaLike
    {
        public Guid Id { get; set; }
        public Guid MediaItemId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public DateTime LikedAt { get; set; } = DateTime.UtcNow;

        public MediaItem MediaItem { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
