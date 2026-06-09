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
    }
} 