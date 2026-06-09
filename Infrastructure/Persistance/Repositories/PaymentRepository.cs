using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    public class PaymentRepository : Repository<Payment>, IPaymentRepository
    {
        public PaymentRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<Payment?> GetByOrderIdAsync(Guid orderId)
        {
            return await _dbSet
                .Include(p => p.Order)
                .Include(p => p.PromotionCode)
                .FirstOrDefaultAsync(p => p.OrderId == orderId);
        }

        public async Task<IEnumerable<Payment>> GetPaymentsByStatusAsync(PaymentStatus status)
        {
            return await _dbSet
                .Include(p => p.Order)
                .Include(p => p.PromotionCode)
                .Where(p => p.Status == status)
                .ToListAsync();
        }

        public async Task<IEnumerable<Payment>> GetPaymentsByDateRangeAsync(DateTime startDate, DateTime endDate)
        {
            return await _dbSet
                .Include(p => p.Order)
                .Include(p => p.PromotionCode)
                .Where(p => p.PaymentDate >= startDate && p.PaymentDate <= endDate)
                .ToListAsync();
        }

        public async Task<Payment?> GetByTransactionIdAsync(string transactionId)
        {
            return await _dbSet
                .Include(p => p.Order)
                .Include(p => p.PromotionCode)
                .FirstOrDefaultAsync(p => p.TransactionId == transactionId);
        }
    }
} 