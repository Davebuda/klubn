using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IDJProfileRepository : IRepository<DJProfile>
    {
        Task<DJProfile?> GetByNameAsync(string name);
        Task<IEnumerable<DJProfile>> GetDJsByGenreAsync(Guid genreId);
        Task<IEnumerable<DJProfile>> GetDJsWithTop10Async();
        Task<DJProfile?> GetDJWithEventsAsync(Guid djId);
    }
} 