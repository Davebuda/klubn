using DJDiP.Application.DTO.DJProfileDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IFollowService
    {
        Task FollowDjAsync(string userId, Guid djId);
        Task UnfollowDjAsync(string userId, Guid djId);
        Task<bool> IsFollowingAsync(string userId, Guid djId);
        Task<int> GetFollowerCountAsync(Guid djId);
        Task<Dictionary<Guid, int>> GetFollowerCountsAsync(IEnumerable<Guid> djIds);
        Task<IEnumerable<DJProfileListItemDto>> GetFollowedDjsAsync(string userId);
    }
}
