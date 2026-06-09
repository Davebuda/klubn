using DJDiP.Application.DTO.DJTop10DTO;
using DJDiP.Application.DTO.SongDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class DJTop10Service : IDJTop10Service
    {
        private readonly IUnitOfWork _unitOfWork;

        public DJTop10Service(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<DJTop10ListDto>> GetAllAsync()
        {
            var entries = await _unitOfWork.DJTop10s.GetAllAsync();
            var djs = await _unitOfWork.DJProfiles.GetAllAsync();
            var songs = await _unitOfWork.Songs.GetAllAsync();

            var djLookup = djs.ToDictionary(d => d.Id, d => d.StageName ?? d.Name ?? string.Empty);
            var songTitleLookup = songs.ToDictionary(s => s.Id, s => s.Title ?? string.Empty);
            var songObjectLookup = songs.ToDictionary(s => s.Id, s => s);

            return entries
                .GroupBy(entry => entry.DJId)
                .Select(group => new DJTop10ListDto
                {
                    DJId = group.Key,
                    DJStageName = djLookup.TryGetValue(group.Key, out var stageName) ? stageName : "Unknown DJ",
                    Top10Songs = group.Select(entry => MapToReadDto(entry, djLookup, songTitleLookup, songObjectLookup)).ToList()
                })
                .ToList();
        }

        public async Task<DJTop10ReadDto?> GetByIdAsync(Guid id)
        {
            var entry = await _unitOfWork.DJTop10s.GetByIdAsync(id);
            if (entry == null)
            {
                return null;
            }

            var dj = await _unitOfWork.DJProfiles.GetByIdAsync(entry.DJId);
            var song = await _unitOfWork.Songs.GetByIdAsync(entry.SongId);

            return new DJTop10ReadDto
            {
                Id = entry.Id,
                DJId = entry.DJId,
                DJStageName = dj?.StageName ?? dj?.Name ?? "Unknown DJ",
                SongId = entry.SongId,
                SongTitle = song?.Title ?? "Unknown Track",
                Song = song != null ? new SongDto
                {
                    Id = song.Id,
                    Title = song.Title ?? "Unknown Track",
                    Artist = song.Artist ?? "Unknown Artist",
                    Genre = song.Genre,
                    Duration = song.Duration.HasValue ? (int)song.Duration.Value.TotalSeconds : 0,
                    CoverImageUrl = song.CoverImageUrl,
                    AudioPreviewUrl = song.AudioPreviewUrl,
                    SpotifyUrl = song.SpotifyUrl,
                    SoundCloudUrl = song.SoundCloudUrl
                } : null
            };
        }

        public async Task<Guid> CreateAsync(DJTop10CreateDto dto)
        {
            var dj = await _unitOfWork.DJProfiles.GetByIdAsync(dto.DJId);
            if (dj == null)
            {
                throw new ArgumentException("DJ not found");
            }

            var song = await _unitOfWork.Songs.GetByIdAsync(dto.SongId);
            if (song == null)
            {
                throw new ArgumentException("Song not found");
            }

            var entry = new DJTop10
            {
                Id = Guid.NewGuid(),
                DJId = dto.DJId,
                SongId = dto.SongId
            };

            await _unitOfWork.DJTop10s.AddAsync(entry);
            await _unitOfWork.SaveChangesAsync();

            return entry.Id;
        }

        public async Task DeleteAsync(Guid id)
        {
            var entry = await _unitOfWork.DJTop10s.GetByIdAsync(id);
            if (entry == null)
            {
                return;
            }

            await _unitOfWork.DJTop10s.DeleteAsync(entry);
            await _unitOfWork.SaveChangesAsync();
        }

        private static DJTop10ReadDto MapToReadDto(
            DJTop10 entry,
            IReadOnlyDictionary<Guid, string> djLookup,
            IReadOnlyDictionary<Guid, string> songTitleLookup,
            IReadOnlyDictionary<Guid, Song> songObjectLookup)
        {
            songTitleLookup.TryGetValue(entry.SongId, out var title);
            songObjectLookup.TryGetValue(entry.SongId, out var songEntity);

            return new DJTop10ReadDto
            {
                Id = entry.Id,
                DJId = entry.DJId,
                DJStageName = djLookup.TryGetValue(entry.DJId, out var stageName) && !string.IsNullOrWhiteSpace(stageName)
                    ? stageName
                    : "Unknown DJ",
                SongId = entry.SongId,
                SongTitle = !string.IsNullOrWhiteSpace(title) ? title : "Unknown Track",
                Song = songEntity != null ? new SongDto
                {
                    Id = songEntity.Id,
                    Title = songEntity.Title ?? "Unknown Track",
                    Artist = songEntity.Artist ?? "Unknown Artist",
                    Genre = songEntity.Genre,
                    Duration = songEntity.Duration.HasValue ? (int)songEntity.Duration.Value.TotalSeconds : 0,
                    CoverImageUrl = songEntity.CoverImageUrl,
                    AudioPreviewUrl = songEntity.AudioPreviewUrl,
                    SpotifyUrl = songEntity.SpotifyUrl,
                    SoundCloudUrl = songEntity.SoundCloudUrl
                } : null
            };
        }
    }
}
