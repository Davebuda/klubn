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
    }
} 