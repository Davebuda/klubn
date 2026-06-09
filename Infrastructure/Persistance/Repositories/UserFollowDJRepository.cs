using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    public class UserFollowDJRepository : Repository<UserFollowDJ>, IUserFollowDJRepository
    {
        public UserFollowDJRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<UserFollowDJ?> GetAsync(string userId, Guid djId)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.UserId == userId && f.DJId == djId);
        }

        public async Task<int> CountByDjIdAsync(Guid djId)
        {
            return await _dbSet.CountAsync(f => f.DJId == djId);
        }

        public async Task<Dictionary<Guid, int>> GetFollowerCountsAsync(IEnumerable<Guid> djIds)
        {
            var ids = djIds.ToList();
            if (!ids.Any())
            {
                return new Dictionary<Guid, int>();
            }

            return await _dbSet
                .Where(f => ids.Contains(f.DJId))
                .GroupBy(f => f.DJId)
                .Select(group => new { group.Key, Count = group.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
        }

        public async Task<IEnumerable<UserFollowDJ>> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Include(f => f.DJ)
                    .ThenInclude(dj => dj.Genres)
                .Where(f => f.UserId == userId)
                .ToListAsync();
        }
    }
}
