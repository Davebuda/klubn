using DJDiP.Application.DTO.PaymentDTO;

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
    }
}
