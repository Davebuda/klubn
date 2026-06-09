namespace DJDiP.Domain.Models
{
    public class MediaItem
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public Guid? EventId { get; set; }
        public required string Url { get; set; }
        public string? ThumbnailUrl { get; set; }
        public required string Type { get; set; } // Photo, Video, Audio
        public string? Caption { get; set; }
        public string? Tags { get; set; }
        public bool IsPublic { get; set; } = true;
        public bool IsFeatured { get; set; } = false;
        public int ViewCount { get; set; } = 0;
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public ApplicationUser User { get; set; } = null!;
        public Event? Event { get; set; }
        public List<MediaLike> Likes { get; set; } = new();
        public List<MediaComment> Comments { get; set; } = new();
    }
}
