using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    // Ticket-type reads for the checkout quote (checkout-orchestration design §4.2).
    // The quote service resolves the selected tiers (price/VAT/status/window/limits +
    // live availability) through this seam so it stays in the Application layer with no
    // direct AppDbContext dependency. Availability is computed from the maintained
    // counters (Capacity - QuantitySold - QuantityHeld), never COUNT(*).
    public interface ITicketTypeRepository : IRepository<TicketType>
    {
        // The ticket types for an event whose Ids are in `typeIds`, keyed by Id.
        // Only returns types that belong to `eventId` (callers detect a count mismatch
        // to surface "not found for this event"). No tracking — read-only snapshot.
        Task<IReadOnlyDictionary<Guid, TicketType>> GetByEventAndIdsAsync(
            Guid eventId, IReadOnlyList<Guid> typeIds, CancellationToken ct);
    }
}
