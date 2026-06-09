using DJDiP.Application.DTO.PlaylistDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IPlaylistService
    {
        Task<IEnumerable<PlaylistDto>> GetAllAsync();
        Task<IEnumerable<PlaylistDto>> GetByDjProfileIdAsync(Guid djProfileId);
        Task<PlaylistDto?> GetByIdAsync(Guid id);
        Task<Guid> CreateAsync(CreatePlaylistDto dto);
        Task UpdateAsync(Guid id, UpdatePlaylistDto dto);
        Task DeleteAsync(Guid id);
        Task<Guid> AddSongAsync(AddPlaylistSongDto dto);
        Task RemoveSongAsync(Guid playlistSongId);
    }
}
