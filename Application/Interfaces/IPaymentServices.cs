using DJDiP.Application.DTO.PaymentDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IPaymentService
    {
        Task<bool> ProcessPaymentAsync(CreatePaymentDto dto);
        Task<CreatePaymentDto?> GetPaymentByOrderIdAsync(Guid orderId);
        Task<IEnumerable<CreatePaymentDto>> GetAllPaymentsAsync();
        Task<bool> DeletePaymentAsync(Guid paymentId);
    }
}
