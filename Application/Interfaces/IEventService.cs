
using DJDiP.Application.DTO.EventDTO;

namespace DJDiP.Application.Interfaces 
{
    public interface IEventService
    {
        Task<IEnumerable<EventListDto>> GetAllAsync();
        Task<DetailEventDto?> GetByIdAsync(Guid id);
        Task<Guid> CreateAsync(CreateEventDto dto);
        Task UpdateAsync(Guid id, UpdateEventDto dto);
        Task DeleteAsync(Guid id);
    }
}


