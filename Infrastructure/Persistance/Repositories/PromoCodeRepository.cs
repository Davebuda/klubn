using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    // Promo-code reads for the checkout slice (checkout-orchestration design §4.1).
    public class PromoCodeRepository : Repository<PromotionCode>, IPromoCodeRepository
    {
        public PromoCodeRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<PromotionCode?> GetByCodeWithTypesAsync(string code, CancellationToken ct)
        {
            // Codes are stored uppercase; normalize the input so lookups are
            // case-insensitive without relying on the DB collation (SQLite default is
            // case-sensitive for non-ASCII; Postgres is case-sensitive too).
            var normalized = (code ?? string.Empty).ToUpperInvariant();

            return await _dbSet
                .AsNoTracking()
                .Include(pc => pc.TicketTypes)
                .FirstOrDefaultAsync(pc => pc.Code == normalized, ct);
        }

        public async Task<int> CountActiveRedemptionsForUserAsync(Guid promoCodeId, string userId, CancellationToken ct)
        {
            return await _context.Set<PromoRedemption>()
                .AsNoTracking()
                .CountAsync(r => r.PromoCodeId == promoCodeId
                                 && r.UserId == userId
                                 && (r.Status == PromoRedemptionStatus.Reserved
                                     || r.Status == PromoRedemptionStatus.Consumed), ct);
        }
    }
}
