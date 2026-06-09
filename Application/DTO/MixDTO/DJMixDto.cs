namespace DJDiP.Application.DTO.MixDTO
{
    public class DJMixDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string MixUrl { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
        public string? Genre { get; set; }
        public string? MixType { get; set; }
        public Guid? DjProfileId { get; set; }
        public string? DjName { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
