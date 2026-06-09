using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IPaymentRepository : IRepository<Payment>
    {
        Task<Payment?> GetByOrderIdAsync(Guid orderId);
        Task<IEnumerable<Payment>> GetPaymentsByStatusAsync(PaymentStatus status);
        Task<IEnumerable<Payment>> GetPaymentsByDateRangeAsync(DateTime startDate, DateTime endDate);
        Task<Payment?> GetByTransactionIdAsync(string transactionId);
    }
} 