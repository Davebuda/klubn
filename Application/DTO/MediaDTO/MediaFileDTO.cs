namespace DJDiP.Application.DTO.MediaDTO
{
    public class MediaFileDTO
    {
        public Guid Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
        public string? Description { get; set; }

        public Guid? EventId { get; set; }
        public Guid? DJProfileId { get; set; }
    }

    public class CreateMediaFileDTO
    {
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string? Description { get; set; }

        public Guid? EventId { get; set; }
        public Guid? DJProfileId { get; set; }
    }
}
