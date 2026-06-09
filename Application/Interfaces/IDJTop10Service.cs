using DJDiP.Application.DTO.DJTop10DTO;

namespace DJDiP.Application.Interfaces
{
    public interface IDJTop10Service
    {
        Task<IEnumerable<DJTop10ListDto>> GetAllAsync();
        Task<DJTop10ReadDto?> GetByIdAsync(Guid id);
        Task<Guid> CreateAsync(DJTop10CreateDto dto);
        Task DeleteAsync(Guid id);
    }
}
