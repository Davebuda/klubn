using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface ITicketRepository : IRepository<Ticket>
    {
        Task<IEnumerable<Ticket>> GetTicketsByUserIdAsync(string userId);
        Task<IEnumerable<Ticket>> GetTicketsByEventIdAsync(Guid eventId);
        Task<Ticket?> GetByTicketNumberAsync(string ticketNumber);
        Task<IEnumerable<Ticket>> GetValidTicketsAsync();
        Task<IEnumerable<Ticket>> GetTicketsByDateRangeAsync(DateTime startDate, DateTime endDate);

        // Tickets issued for an order, reached via OrderItem.OrderId. TRACKED (no Include)
        // so the confirmation service can stamp ConfirmationEmailSentTo/Date and save.
        Task<IEnumerable<Ticket>> GetTicketsByOrderAsync(Guid orderId, CancellationToken ct);
    }
} 