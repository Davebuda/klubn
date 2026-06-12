using DJDiP.Application.DTO.DJProfileDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class FollowService : IFollowService
    {
        private readonly IUnitOfWork _unitOfWork;

        public FollowService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task FollowDjAsync(string userId, Guid djId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException("User id is required", nameof(userId));
            }

            var existing = await _unitOfWork.UserFollowDJs.GetAsync(userId, djId);
            if (existing != null)
            {
                return;
            }

            // P0-WS1 (TRUSTS-CLIENT-IDENTITY): the caller is now always the JWT-verified
            // principal (resolver derives userId from the token), so a real account always
            // exists. The old EnsureUserExistsAsync placeholder auto-create — which minted a
            // "Guest Listener" row for any client-supplied id — is removed.
            var follow = new UserFollowDJ
            {
                UserId = userId,
                DJId = djId,
                NotificationsEnabled = true,
                FollowedAt = DateTime.UtcNow
            };

            await _unitOfWork.UserFollowDJs.AddAsync(follow);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task UnfollowDjAsync(string userId, Guid djId)
        {
            var existing = await _unitOfWork.UserFollowDJs.GetAsync(userId, djId);
            if (existing == null)
            {
                return;
            }

            await _unitOfWork.UserFollowDJs.DeleteAsync(existing);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<bool> IsFollowingAsync(string userId, Guid djId)
        {
            var existing = await _unitOfWork.UserFollowDJs.GetAsync(userId, djId);
            return existing != null;
        }

        public Task<int> GetFollowerCountAsync(Guid djId)
        {
            return _unitOfWork.UserFollowDJs.CountByDjIdAsync(djId);
        }

        public Task<Dictionary<Guid, int>> GetFollowerCountsAsync(IEnumerable<Guid> djIds)
        {
            return _unitOfWork.UserFollowDJs.GetFollowerCountsAsync(djIds);
        }

        public async Task<IEnumerable<DJProfileListItemDto>> GetFollowedDjsAsync(string userId)
        {
            var follows = await _unitOfWork.UserFollowDJs.GetByUserIdAsync(userId);
            var followerCounts = await _unitOfWork.UserFollowDJs.GetFollowerCountsAsync(follows.Select(f => f.DJId));

            return follows.Select(f => MapToListItem(f.DJ, followerCounts.TryGetValue(f.DJId, out var count) ? count : 0));
        }

        private static DJProfileListItemDto MapToListItem(DJProfile dj, int followerCount)
        {
            return new DJProfileListItemDto
            {
                Id = dj.Id,
                Name = dj.Name,
                StageName = dj.StageName ?? dj.Name,
                Bio = dj.Bio,
                Genre = dj.Genres.Any() ? string.Join(", ", dj.Genres.Select(g => g.Name)) : dj.Genre ?? string.Empty,
                ProfilePictureUrl = dj.ProfilePictureUrl ?? string.Empty,
                Tagline = dj.Tagline,
                CoverImageUrl = dj.CoverImageUrl,
                FollowerCount = followerCount
            };
        }
    }
}
