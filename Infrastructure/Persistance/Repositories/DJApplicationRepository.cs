using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    public class DJApplicationRepository : Repository<DJApplication>, IDJApplicationRepository
    {
        public DJApplicationRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<DJApplication?> GetByUserIdAsync(string userId)
        {
            return await _dbSet
                .Include(app => app.User)
                .FirstOrDefaultAsync(app => app.UserId == userId);
        }

        public async Task<IEnumerable<DJApplication>> GetByStatusAsync(ApplicationStatus status)
        {
            return await _dbSet
                .Include(app => app.User)
                .Where(app => app.Status == status)
                .OrderByDescending(app => app.SubmittedAt)
                .ToListAsync();
        }

        public async Task<bool> HasPendingApplicationAsync(string userId)
        {
            return await _dbSet
                .AnyAsync(app => app.UserId == userId && app.Status == ApplicationStatus.Pending);
        }
    }
}
