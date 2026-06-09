using DJDiP.Application.DTO.GalleryDTO;
using DJDiP.Application.DTO.HighlightDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services;

public class EventHighlightService : IEventHighlightService
{
    private const int MaxMediaPerHighlight = 6;

    private readonly IUnitOfWork _unitOfWork;

    public EventHighlightService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IEnumerable<EventHighlightDto>> GetPublishedAsync(int limit = 6)
    {
        var all = await _unitOfWork.EventHighlights.GetAllAsync();

        var items = all
            .Where(h => h.IsPublished)
            .OrderBy(h => h.SortOrder)
            .ThenByDescending(h => h.HighlightDate)
            .Take(limit)
            .ToList();

        var result = new List<EventHighlightDto>(items.Count);
        foreach (var item in items)
        {
            result.Add(await MapToDtoAsync(item));
        }

        return result;
    }

    public async Task<IEnumerable<EventHighlightDto>> GetAllAsync()
    {
        var all = await _unitOfWork.EventHighlights.GetAllAsync();

        var items = all
            .OrderBy(h => h.SortOrder)
            .ThenByDescending(h => h.HighlightDate)
            .ToList();

        var result = new List<EventHighlightDto>(items.Count);
        foreach (var item in items)
        {
            result.Add(await MapToDtoAsync(item));
        }

        return result;
    }

    public async Task<EventHighlightDto?> GetByIdAsync(Guid id)
    {
        var item = await _unitOfWork.EventHighlights.GetByIdAsync(id);
        return item != null ? await MapToDtoAsync(item) : null;
    }

    public async Task<Guid> CreateAsync(CreateEventHighlightDto dto)
    {
        var highlight = new EventHighlight
        {
            Id = Guid.NewGuid(),
            EventId = dto.EventId,
            Title = dto.Title,
            Blurb = dto.Blurb,
            CoverImageUrl = dto.CoverImageUrl,
            CoverVideoUrl = dto.CoverVideoUrl,
            HighlightDate = dto.HighlightDate,
            UpcomingEventId = dto.UpcomingEventId,
            IsPublished = dto.IsPublished,
            SortOrder = dto.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.EventHighlights.AddAsync(highlight);
        await _unitOfWork.SaveChangesAsync();

        return highlight.Id;
    }

    public async Task<bool> UpdateAsync(Guid id, UpdateEventHighlightDto dto)
    {
        var item = await _unitOfWork.EventHighlights.GetByIdAsync(id);
        if (item == null) return false;

        if (dto.Title != null) item.Title = dto.Title;
        if (dto.Blurb != null) item.Blurb = dto.Blurb;
        if (dto.CoverImageUrl != null) item.CoverImageUrl = dto.CoverImageUrl;
        if (dto.CoverVideoUrl != null) item.CoverVideoUrl = dto.CoverVideoUrl;
        if (dto.HighlightDate.HasValue) item.HighlightDate = dto.HighlightDate.Value;
        if (dto.UpcomingEventId.HasValue) item.UpcomingEventId = dto.UpcomingEventId.Value;
        if (dto.IsPublished.HasValue) item.IsPublished = dto.IsPublished.Value;
        if (dto.SortOrder.HasValue) item.SortOrder = dto.SortOrder.Value;

        await _unitOfWork.EventHighlights.UpdateAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<bool> SetPublishedAsync(Guid id, bool published)
    {
        var item = await _unitOfWork.EventHighlights.GetByIdAsync(id);
        if (item == null) return false;

        item.IsPublished = published;
        await _unitOfWork.EventHighlights.UpdateAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var item = await _unitOfWork.EventHighlights.GetByIdAsync(id);
        if (item == null) return false;

        await _unitOfWork.EventHighlights.DeleteAsync(item);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    private async Task<EventHighlightDto> MapToDtoAsync(EventHighlight item)
    {
        // The recapped event (EventRepository.GetByIdAsync includes Venue/Genres).
        var recappedEvent = await _unitOfWork.Events.GetByIdAsync(item.EventId);

        Event? upcomingEvent = null;
        if (item.UpcomingEventId.HasValue)
        {
            upcomingEvent = await _unitOfWork.Events.GetByIdAsync(item.UpcomingEventId.Value);
        }

        // A few approved GalleryMedia for the recapped event (body media reuse).
        var media = (await _unitOfWork.GalleryMedia.GetAllAsync())
            .Where(g => g.EventId == item.EventId && g.IsApproved)
            .OrderByDescending(g => g.UploadedAt)
            .Take(MaxMediaPerHighlight)
            .Select(MapMediaToDto)
            .ToList();

        return new EventHighlightDto
        {
            Id = item.Id,
            EventId = item.EventId,
            EventTitle = recappedEvent?.Title,
            EventDate = recappedEvent?.Date ?? default,
            Title = item.Title,
            Blurb = item.Blurb,
            CoverImageUrl = item.CoverImageUrl,
            CoverVideoUrl = item.CoverVideoUrl,
            HighlightDate = item.HighlightDate,
            UpcomingEventId = item.UpcomingEventId,
            UpcomingEventTitle = upcomingEvent?.Title,
            UpcomingEventDate = upcomingEvent?.Date,
            IsPublished = item.IsPublished,
            SortOrder = item.SortOrder,
            Media = media
        };
    }

    private static GalleryMediaDto MapMediaToDto(GalleryMedia item)
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
