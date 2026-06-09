using DJDiP.Application.DTO.OrderStatusDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IOrderStatusService
    {
        Task<IEnumerable<OrderStatusDTO>> GetAllStatusesAsync();
        Task<OrderStatusDTO?> GetStatusByIdAsync(int id);
        Task<OrderStatusDTO> CreateStatusAsync(CreateOrderStatusDTO dto);
        Task<bool> UpdateStatusAsync(int id, CreateOrderStatusDTO dto);
        Task<bool> DeleteStatusAsync(int id);
    }
}
