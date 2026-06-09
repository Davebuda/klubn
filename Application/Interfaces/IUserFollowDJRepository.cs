using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IUserFollowDJRepository : IRepository<UserFollowDJ>
    {
        Task<UserFollowDJ?> GetAsync(string userId, Guid djId);
        Task<int> CountByDjIdAsync(Guid djId);
        Task<Dictionary<Guid, int>> GetFollowerCountsAsync(IEnumerable<Guid> djIds);
        Task<IEnumerable<UserFollowDJ>> GetByUserIdAsync(string userId);
    }
}
