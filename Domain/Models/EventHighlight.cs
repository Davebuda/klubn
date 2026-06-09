namespace DJDiP.Domain.Models
{
    // Editorial per-past-event recap (cover image/video + title + blurb + link).
    // Option C (hybrid): EventHighlight owns the editorial/curation layer; body media
    // is reused from GalleryMedia by EventId — no new media tables or upload paths.
    public class EventHighlight
    {
        public Guid Id { get; set; }

        // The recapped PAST event.
        public Guid EventId { get; set; }
        public Event Event { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public string? Blurb { get; set; }

        // Muted aftermovie loop; image is the fallback/poster.
        public string CoverImageUrl { get; set; } = string.Empty;
        public string? CoverVideoUrl { get; set; }

        public DateTime HighlightDate { get; set; }

        // Relive → rebook CTA target (optional).
        public Guid? UpcomingEventId { get; set; }
        public Event? UpcomingEvent { get; set; }

        public bool IsPublished { get; set; } = false;
        public int SortOrder { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
