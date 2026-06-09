using DJDiP.Application.DTO.GalleryDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services;

public class GalleryMediaService : IGalleryMediaService
{
    private readonly IUnitOfWork _unitOfWork;

    public GalleryMediaService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<GalleryMediaDto>> GetAllAsync(bool approvedOnly = true)
    {
        var all = await _unitOfWork.GalleryMedia.GetAllAsync();

        var items = all
            .Where(g => !approvedOnly || g.IsApproved)
            .OrderByDescending(g => g.IsFeatured)
            .ThenByDescending(g => g.UploadedAt)
            .ToList();

        return items.Select(MapToDto);
    }

    public async Task<IEnumerable<GalleryMediaDto>> GetFeaturedAsync()
    {
        var all = await _unitOfWork.GalleryMedia.GetAllAsync();

        var items = all
            .Where(g => g.IsFeatured && g.IsApproved)
            .OrderByDescending(g => g.UploadedAt)
            .ToList();

        return items.Select(MapToDto);
    }

    public async Task<IEnumerable<GalleryMediaDto>> GetByEventAsync(Guid eventId)
    {
        var all = await _unitOfWork.GalleryMedia.GetAllAsync();

        var items = all
            .Where(g => g.EventId == eventId && g.IsApproved)
            .OrderByDescending(g => g.UploadedAt)
            .ToList();

        return items.Select(MapToDto);
    }

    public async Task<IEnumerable<GalleryMediaDto>> GetByUserAsync(string userId)
    {
        var all = await _unitOfWork.GalleryMedia.GetAllAsync();

        var items = all
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.UploadedAt)
            .ToList();

        return items.Select(MapToDto);
    }

    public async Task<GalleryMediaDto?> GetByIdAsync(Guid id)
    {
        var item = await _unitOfWork.GalleryMedia.GetByIdAsync(id);
        return item != null ? MapToDto(item) : null;
    }

    public async Task<Guid> CreateAsync(CreateGalleryMediaDto dto, string userId)
    {
        var galleryMedia = new GalleryMedia
        {
            Id = Guid.NewGuid(),
            Title = dto.Title,
            Description = dto.Description,
            MediaUrl = dto.MediaUrl,
            MediaType = dto.MediaType,
            ThumbnailUrl = dto.ThumbnailUrl,
            UserId = userId,
            EventId = dto.EventId,
            Tags = dto.Tags,
            UploadedAt = DateTime.UtcNow,
            IsApproved = false, // Requires admin approval
            IsFeatured = false,
            ViewCount = 0,
            LikeCount = 0
        };

        await _unitOfWork.GalleryMedia.AddAsync(galleryMedia);
        await _unitOfWork.SaveChangesAsync();

        return galleryMedia.Id;
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateGalleryMediaDto dto)
    {
        var item = await _unitOfWork.GalleryMedia.GetByIdAsync(id);
        if (item == null) return false;

        if (dto.Title != null) item.Title = dto.Title;
        if (dto.Description != null) item.Description = dto.Description;
        if (dto.IsApproved.HasValue) item.IsApproved = dto.IsApproved.Value;
        if (dto.IsFeatured.HasValue) item.IsFeatured = dto.IsFeatured.Value;
        if (dto.Tags != null) item.Tags = dto.Tags;

        await _unitOfWork.GalleryMedia.UpdateAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var item = await _unitOfWork.GalleryMedia.GetByIdAsync(id);
        if (item == null) return false;

        await _unitOfWork.GalleryMedia.DeleteAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<bool> IncrementViewCountAsync(Guid id)
    {
        var item = await _unitOfWork.GalleryMedia.GetByIdAsync(id);
        if (item == null) return false;

        item.ViewCount++;
        await _unitOfWork.GalleryMedia.UpdateAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ToggleLikeAsync(Guid id, string userId)
    {
        var item = await _unitOfWork.GalleryMedia.GetByIdAsync(id);
        if (item == null) return false;

        // Simple like count increment/decrement
        // In a production app, you'd track individual user likes
        item.LikeCount++;
        await _unitOfWork.GalleryMedia.UpdateAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    private static GalleryMediaDto MapToDto(GalleryMedia item)
    {
        return new GalleryMediaDto
        {
            Id = item.Id,
            Title = item.Title,
            Description = item.Description,
            MediaUrl = item.MediaUrl,
            MediaType = item.MediaType,
            ThumbnailUrl = item.ThumbnailUrl,
            UserId = item.UserId,
            UserName = item.User?.FullName,
            EventId = item.EventId,
            EventTitle = item.Event?.Title,
            UploadedAt = item.UploadedAt,
            IsApproved = item.IsApproved,
            IsFeatured = item.IsFeatured,
            ViewCount = item.ViewCount,
            LikeCount = item.LikeCount,
            Tags = item.Tags
        };
    }
}
