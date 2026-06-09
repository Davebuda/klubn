namespace DJDiP.Application.DTO.PlaylistDTO
{
    public class PlaylistSongDto
    {
        public Guid Id { get; set; }
        public Guid SongId { get; set; }
        public int Position { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Artist { get; set; } = string.Empty;
        public string? Genre { get; set; }
        public string? CoverImageUrl { get; set; }
        public string? SpotifyUrl { get; set; }
        public string? SoundCloudUrl { get; set; }
    }
}
