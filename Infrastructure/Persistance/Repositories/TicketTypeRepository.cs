using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    // Ticket-type reads for the checkout quote (checkout-orchestration design §4.2).
    public class TicketTypeRepository : Repository<TicketType>, ITicketTypeRepository
    {
        public TicketTypeRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<IReadOnlyDictionary<Guid, TicketType>> GetByEventAndIdsAsync(
            Guid eventId, IReadOnlyList<Guid> typeIds, CancellationToken ct)
        {
            return await _dbSet
                .AsNoTracking()
                .Where(t => t.EventId == eventId && typeIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, ct);
        }
    }
}
