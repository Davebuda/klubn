using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    // Promo-code reads for the checkout slice (checkout-orchestration design §4.1).
    // PromoCodeService fetches ONLY the promo row (+ per-user redemption count) — all
    // validation + discount math is pure and DB-free above this seam.
    public interface IPromoCodeRepository : IRepository<PromotionCode>
    {
        // Case-insensitive lookup on Code (codes are stored uppercase; the impl
        // normalizes input with ToUpperInvariant). Eager-loads the TicketTypes join
        // collection so type-scoping can be evaluated without a second round-trip.
        // Returns null when no code matches.
        Task<PromotionCode?> GetByCodeWithTypesAsync(string code, CancellationToken ct);

        // Count of this user's Reserved|Consumed redemptions for the given promo —
        // the per-user-limit check. Released rows do NOT count.
        Task<int> CountActiveRedemptionsForUserAsync(Guid promoCodeId, string userId, CancellationToken ct);
    }
}
