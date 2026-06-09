using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    public class EventRepository : Repository<Event>, IEventRepository
    {
        public EventRepository(AppDbContext context) : base(context)
        {
        }

        public override async Task<Event?> GetByIdAsync(object id)
        {
            if (id is Guid guidId)
            {
                return await _dbSet
                    .Include(e => e.Venue)
                    .Include(e => e.Genres)
                    .Include(e => e.EventDJs)
                    .FirstOrDefaultAsync(e => e.Id == guidId);
            }
            return null;
        }

        public override async Task<IEnumerable<Event>> GetAllAsync()
        {
            return await _dbSet
                .Include(e => e.Venue)
                .Include(e => e.Genres)
                .Include(e => e.EventDJs)
                .ToListAsync();
        }

        public async Task<IEnumerable<Event>> GetEventsByDateRangeAsync(DateTime startDate, DateTime endDate)
        {
            return await _dbSet
                .Include(e => e.Venue)
                .Include(e => e.Genres)
                .Include(e => e.EventDJs)
                .Where(e => e.Date >= startDate && e.Date <= endDate)
                .ToListAsync();
        }

        public async Task<IEnumerable<Event>> GetEventsByVenueAsync(Guid venueId)
        {
            return await _dbSet
                .Include(e => e.Venue)
                .Include(e => e.Genres)
                .Where(e => e.Venue.Id == venueId)
                .ToListAsync();
        }

        public async Task<IEnumerable<Event>> GetEventsByGenreAsync(Guid genreId)
        {
            return await _dbSet
                .Include(e => e.Venue)
                .Include(e => e.Genres)
                .Where(e => e.Genres.Any(g => g.Id == genreId))
                .ToListAsync();
        }

        public async Task<IEnumerable<Event>> GetUpcomingEventsAsync()
        {
            return await _dbSet
                .Include(e => e.Venue)
                .Include(e => e.Genres)
                .Where(e => e.Date > DateTime.UtcNow)
                .OrderBy(e => e.Date)
                .ToListAsync();
        }

        public async Task<IEnumerable<Event>> GetEventsByDJAsync(Guid djId)
        {
            return await _dbSet
                .Include(e => e.Venue)
                .Include(e => e.Genres)
                .Include(e => e.EventDJs)
                .Where(e => e.EventDJs.Any(ed => ed.DJId == djId))
                .ToListAsync();
        }
    }
} 
