namespace DJDiP.Domain.Models
{
    public class Song
    {
        public Guid Id { get; set; }

        public string Title { get; set; } = string.Empty;

        public string Artist { get; set; } = string.Empty;

        public string? Genre { get; set; }

        public TimeSpan? Duration { get; set; }

        public string? CoverImageUrl { get; set; } // optional bilde

        public string? AudioPreviewUrl { get; set; } // optional lydklipp

        public string? SpotifyUrl { get; set; }

        public string? SoundCloudUrl { get; set; }

        public List<DJTop10> DJTop10s { get; set; } = new();
    }
}
