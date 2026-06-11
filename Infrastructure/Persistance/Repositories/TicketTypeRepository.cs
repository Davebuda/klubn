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

        public async Task<IReadOnlyList<TicketType>> GetHiddenOnSaleByEventAsync(
            Guid eventId, IReadOnlyCollection<Guid>? restrictToTypeIds, CancellationToken ct)
        {
            var query = _dbSet
                .AsNoTracking()
                .Where(t => t.EventId == eventId && t.IsHidden && t.Status == TicketTypeStatus.OnSale);

            // Empty/null scope = wildcard unlock (all hidden OnSale tiers of the event);
            // otherwise restrict to the promo's listed tiers.
            if (restrictToTypeIds is { Count: > 0 })
                query = query.Where(t => restrictToTypeIds.Contains(t.Id));

            return await query.OrderBy(t => t.SortOrder).ToListAsync(ct);
        }
    }
}
