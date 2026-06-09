namespace DJDiP.Application.DTO.MixDTO
{
    public class CreateDJMixDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string MixUrl { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
        public string? Genre { get; set; }
        public string? MixType { get; set; }
        public Guid? DjProfileId { get; set; }
    }
}
