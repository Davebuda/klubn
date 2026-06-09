
using DJDiP.Application.DTO.DJProfileDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IDJService
    {
        Task<IEnumerable<DJProfileListItemDto>> GetAllAsync();
        Task<DJProfileDetailDto?> GetByIdAsync(Guid id);
        Task<Guid> CreateAsync(CreateDJProfileDto dto);
        Task UpdateAsync(Guid id, UpdateDJProfileDto dto);
        Task DeleteAsync(Guid id);
    }
}
