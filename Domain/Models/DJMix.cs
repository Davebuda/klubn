namespace DJDiP.Domain.Models
{
    public class DJMix
    {
        public Guid Id { get; set; }

        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string MixUrl { get; set; } = string.Empty;

        public string? ThumbnailUrl { get; set; }

        public string? Genre { get; set; }

        /// <summary>Platform hint: "soundcloud", "mixcloud", "youtube", or null.</summary>
        public string? MixType { get; set; }

        public string? Source { get; set; }
        public string? Duration { get; set; }

        // n8n ingest provenance (used for idempotency)
        public string? SourcePostId { get; set; }
        public string? SourcePlatform { get; set; }

        public Guid? DJProfileId { get; set; }
        public DJProfile? DJProfile { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
