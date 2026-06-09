using DJDiP.Application.DTO.DJApplicationDTO;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IDJApplicationService
    {
        Task<DJApplicationDto> SubmitApplicationAsync(CreateDJApplicationDto dto);
        Task<DJApplicationDto?> GetApplicationByIdAsync(Guid id);
        Task<DJApplicationDto?> GetApplicationByUserIdAsync(string userId);
        Task<IEnumerable<DJApplicationDto>> GetAllApplicationsAsync();
        Task<IEnumerable<DJApplicationDto>> GetPendingApplicationsAsync();
        Task<DJApplicationDto> ApproveApplicationAsync(UpdateApplicationStatusDto dto);
        Task<DJApplicationDto> RejectApplicationAsync(UpdateApplicationStatusDto dto);
        Task<bool> HasPendingApplicationAsync(string userId);
    }
}
