using Application.DTO.PromotionCodeDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IPromotionCodeService
    {
        Task<PromotionCodeDto> CreateAsync(CreatePromotionCodeDto dto);
        Task<PromotionCodeDto?> GetByIdAsync(Guid id);
        Task<IEnumerable<PromotionCodeDto>> GetAllAsync();
        Task<bool> DeleteAsync(Guid id);
        Task<bool> DeactivateAsync(Guid id);
        Task<PromotionCodeDto?> ApplyCodeAsync(ApplyPromotionCodeDto dto);
    }
}