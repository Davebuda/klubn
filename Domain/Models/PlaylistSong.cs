namespace DJDiP.Domain.Models
{
    public class PlaylistSong
    {
        public Guid Id { get; set; }

        public Guid PlaylistId { get; set; }

        public Guid SongId { get; set; }

        public int Position { get; set; }

        public Playlist Playlist { get; set; } = null!;

        public Song Song { get; set; } = null!;
    }
}
