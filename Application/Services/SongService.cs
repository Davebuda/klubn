using System.Linq;
using DJDiP.Application.DTO.SongDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class SongService : ISongService
    {
        private readonly IUnitOfWork _unitOfWork;

        public SongService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<SongDto>> GetAllSongsAsync()
        {
            var songs = await _unitOfWork.Songs.GetAllAsync();
            return songs.Select(MapToDto).ToList();
        }

        public async Task<SongDto?> GetSongByIdAsync(Guid songId)
        {
            var song = await _unitOfWork.Songs.GetByIdAsync(songId);
            return song == null ? null : MapToDto(song);
        }

        public async Task<Guid> AddSongAsync(CreateSongDto songDto)
        {
            var song = new Song
            {
                Id = Guid.NewGuid(),
                Title = songDto.Title,
                Artist = songDto.Artist,
                Genre = songDto.Genre,
                Duration = songDto.Duration > 0 ? TimeSpan.FromSeconds(songDto.Duration) : null,
                CoverImageUrl = songDto.CoverImageUrl,
                AudioPreviewUrl = null,
                SpotifyUrl = songDto.SpotifyUrl,
                SoundCloudUrl = songDto.SoundCloudUrl
            };

            await _unitOfWork.Songs.AddAsync(song);
            await _unitOfWork.SaveChangesAsync();

            return song.Id;
        }

        private static SongDto MapToDto(Song song)
        {
            return new SongDto
            {
                Id = song.Id,
                Title = song.Title,
                Artist = song.Artist,
                Genre = song.Genre,
                Duration = song.Duration.HasValue ? (int)song.Duration.Value.TotalSeconds : 0,
                CoverImageUrl = song.CoverImageUrl,
                AudioPreviewUrl = song.AudioPreviewUrl,
                SpotifyUrl = song.SpotifyUrl,
                SoundCloudUrl = song.SoundCloudUrl
            };
        }
    }
}
