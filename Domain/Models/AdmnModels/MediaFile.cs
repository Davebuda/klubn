namespace DJDiP.Domain.Models.AdmnModels
{
public class MediaFile
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty; // f.eks. "image/jpeg", "video/mp4"
    public string Url { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public string? Description { get; set; }

    // Relasjoner (valgfritt – avhengig av bruk)
    public Guid? EventId { get; set; }
    public Event? Event { get; set; }

    public Guid? DJProfileId { get; set; }
    public DJProfile? DJProfile { get; set; }
}
}