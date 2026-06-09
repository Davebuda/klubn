using DJDiP.Application.DTO.GenreDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IGenreService
    {
        Task<IEnumerable<GenreDto>> GetAllAsync();
        Task<Guid> CreateAsync(CreateGenreDto dto);
        Task UpdateAsync(Guid id, UpdateGenreDto dto);
    }
}