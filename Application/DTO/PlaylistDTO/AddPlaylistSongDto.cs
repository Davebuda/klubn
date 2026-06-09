namespace DJDiP.Application.DTO.PlaylistDTO
{
    public class AddPlaylistSongDto
    {
        public Guid PlaylistId { get; set; }
        public Guid SongId { get; set; }
        public int Position { get; set; }
    }
}
