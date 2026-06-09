using DJDiP.Application.DTO.HighlightDTO;

namespace DJDiP.Application.Interfaces;

public interface IEventHighlightService
{
    Task<IEnumerable<EventHighlightDto>> GetPublishedAsync(int limit = 6);
    Task<IEnumerable<EventHighlightDto>> GetAllAsync(); // admin
    Task<EventHighlightDto?> GetByIdAsync(Guid id);
    Task<Guid> CreateAsync(CreateEventHighlightDto dto);
    Task<bool> UpdateAsync(Guid id, UpdateEventHighlightDto dto);
    Task<bool> SetPublishedAsync(Guid id, bool published);
    Task<bool> DeleteAsync(Guid id);
}
