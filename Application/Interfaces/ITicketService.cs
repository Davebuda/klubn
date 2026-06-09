using DJDiP.Application.DTO.TicketDTO;

namespace DJDiP.Application.Interfaces
{
    public interface ITicketService
    {
        Task<IEnumerable<TicketDto>> GetTicketsByUserIdAsync(string userId);
        Task<IEnumerable<TicketDto>> GetTicketsByEventIdAsync(Guid eventId);
        Task<TicketDto?> GetTicketByIdAsync(Guid ticketId);
        Task<TicketDto> CreateTicketAsync(CreateTicketDto ticketDto);
        Task<bool> CheckInTicketAsync(Guid ticketId);
        Task<bool> InvalidateTicketAsync(Guid ticketId);
        Task<TicketDto?> CancelTicketAsync(CancelTicketDto cancelDto);
        Task<TicketDto?> RefundTicketAsync(RefundTicketDto refundDto);
        Task<TicketDto?> TransferTicketAsync(TransferTicketDto transferDto);
        Task DeleteAsync(Guid ticketId);
    }
}
