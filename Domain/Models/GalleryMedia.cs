namespace DJDiP.Domain.Models;

public class GalleryMedia
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MediaUrl { get; set; } = string.Empty;
    public string MediaType { get; set; } = "image"; // "image" or "video"
    public string? ThumbnailUrl { get; set; }

    // User who uploaded (if user-generated content)
    public string? UserId { get; set; }
    public ApplicationUser? User { get; set; }

    // Event association (if from an event)
    public Guid? EventId { get; set; }
    public Event? Event { get; set; }

    // Metadata
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public bool IsApproved { get; set; } = false; // For moderation
    public bool IsFeatured { get; set; } = false;
    public int ViewCount { get; set; } = 0;
    public int LikeCount { get; set; } = 0;

    // Tags
    public string? Tags { get; set; } // JSON array of tags

    // n8n ingest provenance (used for idempotency)
    public string? SourcePostId { get; set; }
    public string? SourcePlatform { get; set; }
}
