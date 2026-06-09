using DJDiP.Application.DTO.MixDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class DJMixService : IDJMixService
    {
        private readonly IUnitOfWork _unitOfWork;

        public DJMixService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<DJMixDto>> GetAllAsync()
        {
            var mixes = await _unitOfWork.DJMixes.GetAllAsync();
            var djLookup = await BuildDjLookup();
            return mixes.OrderByDescending(m => m.CreatedAt).Select(m => MapToDto(m, djLookup)).ToList();
        }

        public async Task<DJMixDto?> GetByIdAsync(Guid id)
        {
            var mix = await _unitOfWork.DJMixes.GetByIdAsync(id);
            if (mix == null) return null;
            var djLookup = await BuildDjLookup();
            return MapToDto(mix, djLookup);
        }

        public async Task<Guid> CreateAsync(CreateDJMixDto dto)
        {
            var mix = new DJMix
            {
                Id = Guid.NewGuid(),
                Title = dto.Title,
                Description = dto.Description,
                MixUrl = dto.MixUrl,
                ThumbnailUrl = dto.ThumbnailUrl,
                Genre = dto.Genre,
                MixType = dto.MixType,
                DJProfileId = dto.DjProfileId,
                CreatedAt = DateTime.UtcNow
            };

            await _unitOfWork.DJMixes.AddAsync(mix);
            await _unitOfWork.SaveChangesAsync();
            return mix.Id;
        }

        public async Task UpdateAsync(Guid id, CreateDJMixDto dto)
        {
            var mix = await _unitOfWork.DJMixes.GetByIdAsync(id);
            if (mix == null) throw new ArgumentException("Mix not found.");

            mix.Title = dto.Title;
            mix.Description = dto.Description;
            mix.MixUrl = dto.MixUrl;
            mix.ThumbnailUrl = dto.ThumbnailUrl;
            mix.Genre = dto.Genre;
            mix.MixType = dto.MixType;
            mix.DJProfileId = dto.DjProfileId;
            // Ensure CreatedAt has UTC kind — columns created with TIMESTAMP (no tz) come back as Unspecified
            mix.CreatedAt = DateTime.SpecifyKind(mix.CreatedAt, DateTimeKind.Utc);

            await _unitOfWork.DJMixes.UpdateAsync(mix);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid id)
        {
            var mix = await _unitOfWork.DJMixes.GetByIdAsync(id);
            if (mix == null) return;
            await _unitOfWork.DJMixes.DeleteAsync(mix);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<IReadOnlyDictionary<Guid, string>> BuildDjLookup()
        {
            var djs = await _unitOfWork.DJProfiles.GetAllAsync();
            return djs.ToDictionary(d => d.Id, d => d.StageName ?? d.Name);
        }

        private static DJMixDto MapToDto(DJMix mix, IReadOnlyDictionary<Guid, string> djLookup)
        {
            return new DJMixDto
            {
                Id = mix.Id,
                Title = mix.Title,
                Description = mix.Description,
                MixUrl = mix.MixUrl,
                ThumbnailUrl = mix.ThumbnailUrl,
                Genre = mix.Genre,
                MixType = mix.MixType,
                DjProfileId = mix.DJProfileId,
                DjName = mix.DJProfileId.HasValue && djLookup.TryGetValue(mix.DJProfileId.Value, out var name) ? name : null,
                CreatedAt = mix.CreatedAt
            };
        }
    }
}
