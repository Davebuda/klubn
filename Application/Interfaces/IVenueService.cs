using DJDiP.Application.DTO.VenueDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IVenueService
    {
        Task<IEnumerable<VenueDto>> GetAllAsync();
        Task<VenueDto?> GetByIdAsync(Guid id);
        Task<Guid> CreateAsync(CreateVenueDto dto);
        Task UpdateAsync(Guid id, UpdateVenueDto dto);
        Task DeleteAsync(Guid id);
    }
}
