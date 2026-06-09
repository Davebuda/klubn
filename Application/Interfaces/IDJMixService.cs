using DJDiP.Application.DTO.MixDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IDJMixService
    {
        Task<IEnumerable<DJMixDto>> GetAllAsync();
        Task<DJMixDto?> GetByIdAsync(Guid id);
        Task<Guid> CreateAsync(CreateDJMixDto dto);
        Task UpdateAsync(Guid id, CreateDJMixDto dto);
        Task DeleteAsync(Guid id);
    }
}
