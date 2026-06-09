using System.Text.Json;
using DJDiP.Application.DTO.DJProfileDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class DJService : IDJService
    {
        private readonly IUnitOfWork _unitOfWork;

        public DJService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<DJProfileListItemDto>> GetAllAsync()
        {
            var djs = await _unitOfWork.DJProfiles.GetAllAsync();
            var followerCounts = await _unitOfWork.UserFollowDJs.GetFollowerCountsAsync(djs.Select(dj => dj.Id));
            var allReviews = await _unitOfWork.DJReviews.GetAllAsync();
            var reviewsByDj = allReviews
                .GroupBy(r => r.DJId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var now = DateTime.UtcNow;
            return djs.Select(dj =>
            {
                var hasReviews = reviewsByDj.TryGetValue(dj.Id, out var reviews) && reviews.Count > 0;
                var upcomingEvents = (dj.EventDJs ?? Enumerable.Empty<EventDJ>())
                    .Where(ed => ed.Event != null && ed.Event.Date >= now)
                    .OrderBy(ed => ed.Event!.Date)
                    .Take(5)
                    .Select(ed => new DJProfileEventSummaryDto
                    {
                        EventId = ed.Event!.Id,
                        Title = ed.Event.Title,
                        Date = DateTime.SpecifyKind(ed.Event.Date, DateTimeKind.Utc),
                        VenueName = ed.Event.Venue?.Name ?? "TBA",
                        City = ed.Event.Venue?.City,
                        Price = ed.Event.Price,
                        ImageUrl = ed.Event.ImageUrl
                    })
                    .ToList();

                return new DJProfileListItemDto
                {
                    Id = dj.Id,
                    UserId = dj.UserId,
                    Name = dj.Name,
                    StageName = dj.StageName ?? dj.Name,
                    Bio = dj.Bio,
                    Genre = dj.Genres.Any() ? string.Join(", ", dj.Genres.Select(g => g.Name)) : dj.Genre ?? string.Empty,
                    ProfilePictureUrl = dj.ProfilePictureUrl ?? string.Empty,
                    Tagline = dj.Tagline,
                    CoverImageUrl = dj.CoverImageUrl,
                    FollowerCount = followerCounts.TryGetValue(dj.Id, out var count) ? count : 0,
                    AverageRating = hasReviews ? Math.Round(reviews!.Average(r => r.Rating), 1) : 0,
                    ReviewCount = hasReviews ? reviews!.Count : 0,
                    Specialties = dj.Specialties,
                    Achievements = dj.Achievements,
                    YearsExperience = dj.YearsExperience,
                    InfluencedBy = dj.InfluencedBy,
                    UpcomingEvents = upcomingEvents
                };
            });
        }

        public async Task<DJProfileDetailDto?> GetByIdAsync(Guid id)
        {
            var dj = await _unitOfWork.DJProfiles.GetDJWithEventsAsync(id);
            if (dj == null) return null;

            var followerCount = await _unitOfWork.UserFollowDJs.CountByDjIdAsync(id);
            var events = dj.EventDJs?
                .Where(ed => ed.Event != null)
                .Select(ed => ed.Event!)
                .OrderBy(e => e.Date)
                .Take(4)
                .Select(e => new DJProfileEventSummaryDto
                {
                    EventId = e.Id,
                    Title = e.Title,
                    Date = e.Date,
                    VenueName = e.Venue?.Name ?? "TBA",
                    City = e.Venue?.City,
                    Price = e.Price,
                    ImageUrl = e.ImageUrl
                })
                .ToList() ?? new List<DJProfileEventSummaryDto>();

            return new DJProfileDetailDto
            {
                Id = dj.Id,
                StageName = dj.StageName ?? dj.Name,
                Name = dj.Name,
                Bio = dj.Bio,
                LongBio = dj.LongBio,
                SocialLinks = DJProfileMappings.ParseSocialLinks(dj.SocialLinks),
                Genre = dj.Genres.Any() ? string.Join(", ", dj.Genres.Select(g => g.Name)) : dj.Genre ?? string.Empty,
                ProfilePictureUrl = dj.ProfilePictureUrl ?? string.Empty,
                CoverImageUrl = dj.CoverImageUrl,
                Tagline = dj.Tagline,
                Specialties = dj.Specialties,
                Achievements = dj.Achievements,
                YearsExperience = dj.YearsExperience,
                InfluencedBy = dj.InfluencedBy,
                EquipmentUsed = dj.EquipmentUsed,
                TopTracks = DJProfileMappings.ParseTopTracks(dj.Top10SongTitles),
                GenreIds = dj.Genres.Select(g => g.Id).ToList(),
                FollowerCount = followerCount,
                UpcomingEvents = events
            };
        }

        public async Task<Guid> CreateAsync(CreateDJProfileDto dto)
        {
            var dj = new DJProfile
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                Name = dto.FullName ?? dto.StageName,
                StageName = dto.StageName,
                Bio = dto.Bio,
                LongBio = dto.LongBio,
                Tagline = dto.Tagline,
                Genre = dto.Genre,
                SocialLinks = dto.SocialLinks,
                ProfilePictureUrl = dto.ProfilePictureUrl,
                CoverImageUrl = dto.CoverImageUrl,
                Specialties = dto.Specialties,
                Achievements = dto.Achievements,
                YearsExperience = dto.YearsExperience,
                InfluencedBy = dto.InfluencedBy,
                EquipmentUsed = dto.EquipmentUsed,
                Top10SongTitles = DJProfileMappings.SerializeList(dto.TopTracks)
            };

            await _unitOfWork.DJProfiles.AddAsync(dj);
            await _unitOfWork.SaveChangesAsync();
            return dj.Id;
        }

        public async Task UpdateAsync(Guid id, UpdateDJProfileDto dto)
        {
            var dj = await _unitOfWork.DJProfiles.GetByIdAsync(id);
            if (dj == null) throw new ArgumentException("DJ not found");

            dj.Name = dto.FullName ?? dto.StageName;
            dj.StageName = dto.StageName;
            dj.Bio = dto.Bio;
            dj.LongBio = dto.LongBio;
            dj.Tagline = dto.Tagline;
            dj.Genre = dto.Genre;
            dj.SocialLinks = dto.SocialLinks;
            dj.ProfilePictureUrl = dto.ProfilePictureUrl;
            dj.CoverImageUrl = dto.CoverImageUrl;
            dj.Specialties = dto.Specialties;
            dj.Achievements = dto.Achievements;
            dj.YearsExperience = dto.YearsExperience;
            dj.InfluencedBy = dto.InfluencedBy;
            dj.EquipmentUsed = dto.EquipmentUsed;
            dj.Top10SongTitles = DJProfileMappings.SerializeList(dto.TopTracks);

            await _unitOfWork.DJProfiles.UpdateAsync(dj);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid id)
        {
            var dj = await _unitOfWork.DJProfiles.GetByIdAsync(id);
            if (dj == null) return;
            await _unitOfWork.DJProfiles.DeleteAsync(dj);
            await _unitOfWork.SaveChangesAsync();
        }
    }

    internal static class DJProfileMappings
    {
        internal static string? SerializeList(List<string>? values)
        {
            if (values == null || values.Count == 0)
            {
                return null;
            }

            return JsonSerializer.Serialize(values);
        }

        internal static List<SocialLinkDto> ParseSocialLinks(string? rawSocialLinks)
        {
            if (string.IsNullOrWhiteSpace(rawSocialLinks))
            {
                return new List<SocialLinkDto>();
            }

            // Try JSON array format: [{"label":"...","url":"..."}]
            try
            {
                var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsedList = JsonSerializer.Deserialize<List<SocialLinkDto>>(rawSocialLinks, opts);
                if (parsedList != null)
                {
                    var validLinks = parsedList
                        .Where(l => !string.IsNullOrWhiteSpace(l.Url))
                        .ToList();
                    if (validLinks.Any()) return validLinks;
                }
            }
            catch { }

            // Try JSON object format: {"Instagram":"url",...} (legacy)
            try
            {
                var parsedDictionary = JsonSerializer.Deserialize<Dictionary<string, string>>(rawSocialLinks);
                if (parsedDictionary != null && parsedDictionary.Any())
                {
                    return parsedDictionary
                        .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
                        .Select(pair => new SocialLinkDto { Label = pair.Key, Url = pair.Value })
                        .ToList();
                }
            }
            catch { }

            return new List<SocialLinkDto>();
        }

        internal static List<string> ParseTopTracks(string? rawTopTracks)
        {
            if (string.IsNullOrWhiteSpace(rawTopTracks))
            {
                return new List<string>();
            }

            try
            {
                var parsed = JsonSerializer.Deserialize<List<string>>(rawTopTracks);
                if (parsed != null && parsed.Count > 0)
                {
                    return parsed;
                }
            }
            catch
            {
                // fallback to manual parsing
            }

            return rawTopTracks
                .Split(new[] { '\n', ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }
    }
}
