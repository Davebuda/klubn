using DJDiP.Application.DTO.GalleryDTO;

namespace DJDiP.Application.Interfaces;

public interface IGalleryMediaService
{
    Task<IEnumerable<GalleryMediaDto>> GetAllAsync(bool approvedOnly = true);
    Task<IEnumerable<GalleryMediaDto>> GetFeaturedAsync();
    Task<IEnumerable<GalleryMediaDto>> GetByEventAsync(Guid eventId);
    Task<IEnumerable<GalleryMediaDto>> GetByUserAsync(string userId);
    Task<GalleryMediaDto?> GetByIdAsync(Guid id);
    Task<Guid> CreateAsync(CreateGalleryMediaDto dto, string userId);
    Task<bool> UpdateAsync(Guid id, UpdateGalleryMediaDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<bool> IncrementViewCountAsync(Guid id);
    Task<bool> ToggleLikeAsync(Guid id, string userId);
}
