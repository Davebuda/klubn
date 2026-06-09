namespace DJDiP.Application.DTO.GalleryDTO;

public class GalleryMediaDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MediaUrl { get; set; } = string.Empty;
    public string MediaType { get; set; } = "image";
    public string? ThumbnailUrl { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public Guid? EventId { get; set; }
    public string? EventTitle { get; set; }
    public DateTime UploadedAt { get; set; }
    public bool IsApproved { get; set; }
    public bool IsFeatured { get; set; }
    public int ViewCount { get; set; }
    public int LikeCount { get; set; }
    public string? Tags { get; set; }
}

public class CreateGalleryMediaDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MediaUrl { get; set; } = string.Empty;
    public string MediaType { get; set; } = "image";
    public string? ThumbnailUrl { get; set; }
    public Guid? EventId { get; set; }
    public string? Tags { get; set; }
}

public class UpdateGalleryMediaDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? IsApproved { get; set; }
    public bool? IsFeatured { get; set; }
    public string? Tags { get; set; }
}
