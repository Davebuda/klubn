using DJDiP.Application.DTO.SongDTO;

namespace DJDiP.Application.Interfaces
{
    public interface ISongService
    {
        Task<IEnumerable<SongDto>> GetAllSongsAsync();
        Task<SongDto?> GetSongByIdAsync(Guid songId);
        Task<Guid> AddSongAsync(CreateSongDto songDto);
    }
}
