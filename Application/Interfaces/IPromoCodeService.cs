using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    // Promo-code validation + discount math (checkout-orchestration design §4.1).
    //
    // PURE in spirit: the only DB reads are the promo row (+ per-user redemption count);
    // the caller (quote service / orchestrator) supplies already-resolved ticket-type
    // data as PromoLine[] so the validation+math core is deterministic and unit-testable.
    // The service throws NOTHING for business failures — every failure is an Ok=false
    // PromoValidationResult with a user-displayable Reason. It NEVER mutates state
    // (reservation SQL lives in the orchestrator, C4).
    public interface IPromoCodeService
    {
        Task<PromoValidationResult> ValidateAsync(
            string code,
            Guid eventId,
            IReadOnlyList<PromoLine> lines,
            string? userId,
            CancellationToken ct);

        // Hidden-tier reveal (checkout-orchestration design §3.2). PURE READ — resolves the
        // hidden OnSale tiers a code unlocks for an event so the public ticketTypes query can
        // surface a tier the buyer can't otherwise see. Reserves/redeems NOTHING. Applies the
        // SAME visibility-relevant rules as ValidateAsync (normalize, IsActive, validity
        // window, event scope, global usage cap) and requires UnlocksHiddenTypes==true. On ANY
        // failure — unknown/expired/inactive code, wrong event, usage exhausted, not an unlock
        // code — returns an EMPTY list, indistinguishable from passing no code (anti-oracle:
        // never leak why a code didn't reveal a tier). The promo's TicketTypes scope restricts
        // which hidden tiers reveal; an empty scope + UnlocksHiddenTypes reveals all hidden
        // OnSale tiers of the event.
        Task<IReadOnlyList<TicketType>> ResolveHiddenUnlockAsync(
            string? code,
            Guid eventId,
            CancellationToken ct);
    }
}
