using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IDJApplicationRepository : IRepository<DJApplication>
    {
        Task<DJApplication?> GetByUserIdAsync(string userId);
        Task<IEnumerable<DJApplication>> GetByStatusAsync(ApplicationStatus status);
        Task<bool> HasPendingApplicationAsync(string userId);
    }
}
