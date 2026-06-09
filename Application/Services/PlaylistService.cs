using DJDiP.Application.DTO.PlaylistDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class PlaylistService : IPlaylistService
    {
        private readonly IUnitOfWork _unitOfWork;

        public PlaylistService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<PlaylistDto>> GetAllAsync()
        {
            var playlists = await _unitOfWork.Playlists.GetAllAsync();
            var playlistSongs = await _unitOfWork.PlaylistSongs.GetAllAsync();
            var songs = await _unitOfWork.Songs.GetAllAsync();
            var djProfiles = await _unitOfWork.DJProfiles.GetAllAsync();

            var songLookup = songs.ToDictionary(s => s.Id, s => s);
            var djLookup = djProfiles.ToDictionary(d => d.Id, d => d);

            return playlists.Select(p => MapToDto(p, playlistSongs, songLookup, djLookup)).ToList();
        }

        public async Task<PlaylistDto?> GetByIdAsync(Guid id)
        {
            var playlist = await _unitOfWork.Playlists.GetByIdAsync(id);
            if (playlist == null) return null;

            var playlistSongs = await _unitOfWork.PlaylistSongs.GetAllAsync();
            var songs = await _unitOfWork.Songs.GetAllAsync();
            var djProfiles = await _unitOfWork.DJProfiles.GetAllAsync();
            var songLookup = songs.ToDictionary(s => s.Id, s => s);
            var djLookup = djProfiles.ToDictionary(d => d.Id, d => d);

            return MapToDto(playlist, playlistSongs, songLookup, djLookup);
        }

        public async Task<IEnumerable<PlaylistDto>> GetByDjProfileIdAsync(Guid djProfileId)
        {
            var playlists = (await _unitOfWork.Playlists.GetAllAsync())
                .Where(p => p.DJProfileId == djProfileId);
            var playlistSongs = await _unitOfWork.PlaylistSongs.GetAllAsync();
            var songs = await _unitOfWork.Songs.GetAllAsync();
            var songLookup = songs.ToDictionary(s => s.Id, s => s);
            var djProfiles = await _unitOfWork.DJProfiles.GetAllAsync();
            var djLookup = djProfiles.ToDictionary(d => d.Id, d => d);

            return playlists.Select(p => MapToDto(p, playlistSongs, songLookup, djLookup)).ToList();
        }

        public async Task<Guid> CreateAsync(CreatePlaylistDto dto)
        {
            var playlist = new Playlist
            {
                Id = Guid.NewGuid(),
                Title = dto.Title,
                Description = dto.Description,
                Genre = dto.Genre,
                CoverImageUrl = dto.CoverImageUrl,
                Curator = dto.Curator,
                PlaylistUrl = dto.PlaylistUrl,
                DJProfileId = dto.DjProfileId,
                CreatedAt = DateTime.UtcNow
            };

            await _unitOfWork.Playlists.AddAsync(playlist);
            await _unitOfWork.SaveChangesAsync();

            return playlist.Id;
        }

        public async Task UpdateAsync(Guid id, UpdatePlaylistDto dto)
        {
            var playlist = await _unitOfWork.Playlists.GetByIdAsync(id);
            if (playlist == null) throw new ArgumentException("Playlist not found");

            playlist.Title = dto.Title;
            playlist.Description = dto.Description;
            playlist.Genre = dto.Genre;
            playlist.CoverImageUrl = dto.CoverImageUrl;
            playlist.Curator = dto.Curator;
            playlist.PlaylistUrl = dto.PlaylistUrl;
            playlist.CreatedAt = DateTime.SpecifyKind(playlist.CreatedAt, DateTimeKind.Utc);

            await _unitOfWork.Playlists.UpdateAsync(playlist);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid id)
        {
            var playlist = await _unitOfWork.Playlists.GetByIdAsync(id);
            if (playlist == null) return;

            // Delete associated playlist songs first
            var allPlaylistSongs = await _unitOfWork.PlaylistSongs.GetAllAsync();
            var songsToDelete = allPlaylistSongs.Where(ps => ps.PlaylistId == id).ToList();
            foreach (var ps in songsToDelete)
            {
                await _unitOfWork.PlaylistSongs.DeleteAsync(ps);
            }

            await _unitOfWork.Playlists.DeleteAsync(playlist);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<Guid> AddSongAsync(AddPlaylistSongDto dto)
        {
            var playlist = await _unitOfWork.Playlists.GetByIdAsync(dto.PlaylistId);
            if (playlist == null) throw new ArgumentException("Playlist not found");

            var song = await _unitOfWork.Songs.GetByIdAsync(dto.SongId);
            if (song == null) throw new ArgumentException("Song not found");

            var entry = new PlaylistSong
            {
                Id = Guid.NewGuid(),
                PlaylistId = dto.PlaylistId,
                SongId = dto.SongId,
                Position = dto.Position
            };

            await _unitOfWork.PlaylistSongs.AddAsync(entry);
            await _unitOfWork.SaveChangesAsync();

            return entry.Id;
        }

        public async Task RemoveSongAsync(Guid playlistSongId)
        {
            var entry = await _unitOfWork.PlaylistSongs.GetByIdAsync(playlistSongId);
            if (entry == null) return;

            await _unitOfWork.PlaylistSongs.DeleteAsync(entry);
            await _unitOfWork.SaveChangesAsync();
        }

        private static PlaylistDto MapToDto(
            Playlist playlist,
            IEnumerable<PlaylistSong> allPlaylistSongs,
            IReadOnlyDictionary<Guid, Song> songLookup,
            IReadOnlyDictionary<Guid, DJProfile> djLookup)
        {
            var playlistSongs = allPlaylistSongs
                .Where(ps => ps.PlaylistId == playlist.Id)
                .OrderBy(ps => ps.Position)
                .Select(ps =>
                {
                    songLookup.TryGetValue(ps.SongId, out var song);
                    return new PlaylistSongDto
                    {
                        Id = ps.Id,
                        SongId = ps.SongId,
                        Position = ps.Position,
                        Title = song?.Title ?? "Unknown Track",
                        Artist = song?.Artist ?? "Unknown Artist",
                        Genre = song?.Genre,
                        CoverImageUrl = song?.CoverImageUrl,
                        SpotifyUrl = song?.SpotifyUrl,
                        SoundCloudUrl = song?.SoundCloudUrl
                    };
                })
                .ToList();

            string? djName = null;
            if (playlist.DJProfileId.HasValue && djLookup.TryGetValue(playlist.DJProfileId.Value, out var dj))
            {
                djName = dj.StageName ?? dj.Name;
            }

            return new PlaylistDto
            {
                Id = playlist.Id,
                Title = playlist.Title,
                Description = playlist.Description,
                Genre = playlist.Genre,
                CoverImageUrl = playlist.CoverImageUrl,
                Curator = playlist.Curator,
                PlaylistUrl = playlist.PlaylistUrl,
                DjProfileId = playlist.DJProfileId,
                DjName = djName,
                CreatedAt = playlist.CreatedAt,
                Songs = playlistSongs
            };
        }
    }
}
