using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    // Server-side promo validation + discount computation (checkout-orchestration
    // design §4.1). The math lives in the pure PromoMath class; this service owns the
    // rule set and the (minimal) DB reads. Throws nothing for business failures —
    // returns Ok=false + a friendly Reason. NEVER mutates state.
    public sealed class PromoCodeService : IPromoCodeService
    {
        private readonly IUnitOfWork _unitOfWork;

        public PromoCodeService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<PromoValidationResult> ValidateAsync(
            string code,
            Guid eventId,
            IReadOnlyList<PromoLine> lines,
            string? userId,
            CancellationToken ct)
        {
            var normalized = (code ?? string.Empty).Trim().ToUpperInvariant();
            if (normalized.Length == 0)
                return PromoValidationResult.Fail(normalized, "Enter a promo code.");

            var promo = await _unitOfWork.PromotionCodes.GetByCodeWithTypesAsync(normalized, ct);
            if (promo is null)
                return PromoValidationResult.Fail(normalized, "This code isn't valid.");

            if (!promo.IsActive)
                return PromoValidationResult.Fail(normalized, "This code is no longer active.");

            var now = DateTime.UtcNow;
            if (promo.ValidFrom.HasValue && now < promo.ValidFrom.Value)
                return PromoValidationResult.Fail(normalized, "This code isn't active yet.");
            if (now > promo.ValidUntil)
                return PromoValidationResult.Fail(normalized, "This code has expired.");

            // EventId scope: null = valid for any event.
            if (promo.EventId.HasValue && promo.EventId.Value != eventId)
                return PromoValidationResult.Fail(normalized, "This code doesn't apply to this event.");

            // Global usage cap — advisory read here (the atomic reservation/CAS happens in
            // the orchestrator, C4). UsageCount < MaxRedemptions when a cap is set.
            if (promo.MaxRedemptions.HasValue && promo.UsageCount >= promo.MaxRedemptions.Value)
                return PromoValidationResult.Fail(normalized, "This code has reached its usage limit.");

            // Per-user cap: requires a signed-in user. If a per-user limit exists but no
            // userId is supplied, fail with a sign-in prompt (design §4.1).
            if (promo.MaxRedemptionsPerUser.HasValue)
            {
                if (string.IsNullOrEmpty(userId))
                    return PromoValidationResult.Fail(normalized, "Sign in to use this code.");

                var used = await _unitOfWork.PromotionCodes
                    .CountActiveRedemptionsForUserAsync(promo.Id, userId, ct);
                if (used >= promo.MaxRedemptionsPerUser.Value)
                    return PromoValidationResult.Fail(normalized, "You've already used this code.");
            }

            // Type scoping: empty TicketTypes list = all lines eligible; otherwise only
            // the listed tiers are eligible for discount/unlock.
            var scopedTypeIds = promo.TicketTypes.Select(t => t.TicketTypeId).ToHashSet();
            bool ScopedToType(Guid typeId) => scopedTypeIds.Count == 0 || scopedTypeIds.Contains(typeId);

            // Hidden unlock (design §3.2/§4.1). UnlockedTicketTypeIds =
            //  - the promo's listed types when UnlocksHiddenTypes is set with a non-empty list;
            //  - ADMIN FOOT-GUN: an empty promo type list + UnlocksHiddenTypes=true unlocks
            //    ALL hidden types of the scoped event. This combination is validated (not
            //    banned) — the unlock set is then "every hidden line in this selection".
            //    Flagged here so admins know a wildcard-unlock code is broad by design.
            IReadOnlyList<Guid> unlocked;
            if (promo.UnlocksHiddenTypes)
            {
                unlocked = scopedTypeIds.Count == 0
                    ? lines.Where(l => l.IsHidden).Select(l => l.TicketTypeId).Distinct().ToList()
                    : lines.Where(l => l.IsHidden && scopedTypeIds.Contains(l.TicketTypeId))
                           .Select(l => l.TicketTypeId).Distinct().ToList();
            }
            else
            {
                unlocked = Array.Empty<Guid>();
            }

            // Eligible discount lines: in scope by type. (Hidden lines that are NOT
            // unlocked are rejected by the QUOTE service before pricing; the promo math
            // here simply discounts the lines it's handed that fall in scope.)
            var eligible = lines
                .Where(l => ScopedToType(l.TicketTypeId))
                .Select(l => (l.TicketTypeId, LineGrossMinor: checked(l.UnitPriceMinor * l.Quantity)))
                .Where(x => x.LineGrossMinor > 0)
                .ToList();

            if (eligible.Count == 0)
                return PromoValidationResult.Fail(normalized, "This code doesn't apply to the selected tickets.");

            var perLine = PromoMath.Allocate(
                promo.Kind, promo.DiscountPercentage, promo.AmountMinor, eligible);

            var total = perLine.Sum(p => p.DiscountMinor);

            return new PromoValidationResult
            {
                Ok = true,
                Reason = null,
                PromoCodeId = promo.Id,
                Code = normalized,
                DiscountMinor = total,
                PerLineDiscounts = perLine,
                UnlockedTicketTypeIds = unlocked
            };
        }
    }
}
