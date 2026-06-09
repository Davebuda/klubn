using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    public class TicketRepository : Repository<Ticket>, ITicketRepository
    {
        public TicketRepository(AppDbContext context) : base(context)
        {
        }

        public override async Task<Ticket?> GetByIdAsync(object id)
        {
            if (id is Guid guid)
            {
                return await _dbSet
                    .Include(t => t.Event)
                        .ThenInclude(e => e.Venue)
                    .Include(t => t.User)
                    .FirstOrDefaultAsync(t => t.Id == guid);
            }

            return await base.GetByIdAsync(id);
        }

        public async Task<IEnumerable<Ticket>> GetTicketsByUserIdAsync(string userId)
        {
            return await _dbSet
                .Include(t => t.Event)
                    .ThenInclude(e => e.Venue)
                .Include(t => t.User)
                .Where(t => t.UserId == userId)
                .ToListAsync();
        }

        public async Task<IEnumerable<Ticket>> GetTicketsByEventIdAsync(Guid eventId)
        {
            return await _dbSet
                .Include(t => t.Event)
                    .ThenInclude(e => e.Venue)
                .Include(t => t.User)
                .Where(t => t.EventId == eventId)
                .ToListAsync();
        }

        public async Task<Ticket?> GetByTicketNumberAsync(string ticketNumber)
        {
            return await _dbSet
                .Include(t => t.Event)
                    .ThenInclude(e => e.Venue)
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TicketNumber == ticketNumber);
        }

        public async Task<IEnumerable<Ticket>> GetValidTicketsAsync()
        {
            return await _dbSet
                .Include(t => t.Event)
                    .ThenInclude(e => e.Venue)
                .Include(t => t.User)
                .Where(t => t.IsValid)
                .ToListAsync();
        }

        public async Task<IEnumerable<Ticket>> GetTicketsByDateRangeAsync(DateTime startDate, DateTime endDate)
        {
            return await _dbSet
                .Include(t => t.Event)
                    .ThenInclude(e => e.Venue)
                .Include(t => t.User)
                .Where(t => t.PurchaseDate >= startDate && t.PurchaseDate <= endDate)
                .ToListAsync();
        }
    }
} 
