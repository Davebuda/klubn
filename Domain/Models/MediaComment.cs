namespace DJDiP.Domain.Models
{
    public class MediaComment
    {
        public Guid Id { get; set; }
        public Guid MediaItemId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public required string Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public MediaItem MediaItem { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
