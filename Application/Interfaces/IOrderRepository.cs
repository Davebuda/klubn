using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IOrderRepository : IRepository<Order>
    {
        Task<IEnumerable<Order>> GetOrdersByUserIdAsync(string userId);
        Task<IEnumerable<Order>> GetOrdersByStatusAsync(OrderStatus status);
        Task<IEnumerable<Order>> GetOrdersByDateRangeAsync(DateTime startDate, DateTime endDate);
        Task<Order?> GetOrderWithItemsAsync(Guid orderId);
        Task<IEnumerable<Order>> GetOrdersWithPaymentAsync();

        // Full graph for the post-fulfillment confirmation email (checkout-orchestration
        // §4.4): User (delivery fallback email), OrderItems → Event → Venue (title/date/
        // venue), OrderItems → TicketType (line names). Read-only; null when not found.
        Task<Order?> GetOrderForConfirmationAsync(Guid orderId, CancellationToken ct);
    }
} 