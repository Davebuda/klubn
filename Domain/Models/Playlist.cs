namespace DJDiP.Domain.Models
{
    public class Playlist
    {
        public Guid Id { get; set; }

        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string? Genre { get; set; }

        public string? CoverImageUrl { get; set; }

        public string? Curator { get; set; }

        public string? PlaylistUrl { get; set; }

        // Nullable: null = admin-created, set = DJ-owned
        public Guid? DJProfileId { get; set; }
        public DJProfile? DJProfile { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<PlaylistSong> PlaylistSongs { get; set; } = new();
    }
}
