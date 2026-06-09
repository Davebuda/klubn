namespace DJDiP.Application.DTO.SongDTO
{
    public class CreateSongDto
    {
        public string Title { get; set; } = string.Empty;
        public string Artist { get; set; } = string.Empty;
        public string? Album { get; set; }
        public string? Genre { get; set; }
        public int Duration { get; set; } // in seconds
        public string? CoverImageUrl { get; set; }
        public string? SpotifyUrl { get; set; }
        public string? SoundCloudUrl { get; set; }
    }
}