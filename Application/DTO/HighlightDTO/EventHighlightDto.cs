using DJDiP.Application.DTO.GalleryDTO;

namespace DJDiP.Application.DTO.HighlightDTO;

public class EventHighlightDto
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string? EventTitle { get; set; }
    public DateTime EventDate { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Blurb { get; set; }
    public string CoverImageUrl { get; set; } = string.Empty;
    public string? CoverVideoUrl { get; set; }
    public DateTime HighlightDate { get; set; }
    public Guid? UpcomingEventId { get; set; }
    public string? UpcomingEventTitle { get; set; }
    public DateTime? UpcomingEventDate { get; set; }
    public bool IsPublished { get; set; }
    public int SortOrder { get; set; }

    // A few approved GalleryMedia for the recapped event (body media).
    public List<GalleryMediaDto> Media { get; set; } = new();
}

public class CreateEventHighlightDto
{
    public Guid EventId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Blurb { get; set; }
    public string CoverImageUrl { get; set; } = string.Empty;
    public string? CoverVideoUrl { get; set; }
    public DateTime HighlightDate { get; set; }
    public Guid? UpcomingEventId { get; set; }
    public bool IsPublished { get; set; } = false;
    public int SortOrder { get; set; } = 0;
}

public class UpdateEventHighlightDto
{
    public string? Title { get; set; }
    public string? Blurb { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? CoverVideoUrl { get; set; }
    public DateTime? HighlightDate { get; set; }
    public Guid? UpcomingEventId { get; set; }
    public bool? IsPublished { get; set; }
    public int? SortOrder { get; set; }
}
