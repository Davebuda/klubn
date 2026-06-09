using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IEventRepository : IRepository<Event>
    {
        Task<IEnumerable<Event>> GetEventsByDateRangeAsync(DateTime startDate, DateTime endDate);
        Task<IEnumerable<Event>> GetEventsByVenueAsync(Guid venueId);
        Task<IEnumerable<Event>> GetEventsByGenreAsync(Guid genreId);
        Task<IEnumerable<Event>> GetUpcomingEventsAsync();
        Task<IEnumerable<Event>> GetEventsByDJAsync(Guid djId);
    }
} 