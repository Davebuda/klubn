using DJDiP.Application.DTO.GenreDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class GenreService : IGenreService
    {
        private readonly IUnitOfWork _unitOfWork;

        public GenreService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<GenreDto>> GetAllAsync()
        {
            var genres = await _unitOfWork.Genres.GetAllAsync();
            return genres.Select(g => new GenreDto
            {
                Id = g.Id,
                Name = g.Name
            }).ToList();
        }

        public async Task<Guid> CreateAsync(CreateGenreDto dto)
        {
            var genre = new Genre
            {
                Id = Guid.NewGuid(),
                Name = dto.Name
            };

            await _unitOfWork.Genres.AddAsync(genre);
            await _unitOfWork.SaveChangesAsync();

            return genre.Id;
        }

        public async Task UpdateAsync(Guid id, UpdateGenreDto dto)
        {
            var genre = await _unitOfWork.Genres.GetByIdAsync(id);
            if (genre == null)
            {
                throw new ArgumentException("Genre not found");
            }

            genre.Name = dto.Name;
            await _unitOfWork.Genres.UpdateAsync(genre);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
