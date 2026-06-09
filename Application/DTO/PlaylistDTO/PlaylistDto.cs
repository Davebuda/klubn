namespace DJDiP.Application.DTO.PlaylistDTO
{
    public class PlaylistDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Genre { get; set; }
        public string? CoverImageUrl { get; set; }
        public string? Curator { get; set; }
        public string? PlaylistUrl { get; set; }
        public Guid? DjProfileId { get; set; }
        public string? DjName { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<PlaylistSongDto> Songs { get; set; } = new();
    }
}
