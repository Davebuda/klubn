using System.Text.Json;
using DJDiP.Application.DTO.VenueDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class VenueService : IVenueService
    {
        private readonly IUnitOfWork _unitOfWork;

        public VenueService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<VenueDto>> GetAllAsync()
        {
            var venues = await _unitOfWork.Venues.GetAllAsync();
            return venues.Select(MapToDto).ToList();
        }

        public async Task<VenueDto?> GetByIdAsync(Guid id)
        {
            var venue = await _unitOfWork.Venues.GetByIdAsync(id);
            return venue == null ? null : MapToDto(venue);
        }

        public async Task<Guid> CreateAsync(CreateVenueDto dto)
        {
            var venue = new Venue
            {
                Id = Guid.NewGuid(),
                Name = dto.Name,
                Description = dto.Description,
                Address = dto.Address,
                City = dto.City,
                Country = dto.Country,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Capacity = dto.Capacity,
                ContactEmail = dto.ContactEmail,
                PhoneNumber = dto.PhoneNumber,
                ImageUrl = dto.ImageUrl,
                ImageUrls = dto.ImageUrls != null ? JsonSerializer.Serialize(dto.ImageUrls) : null
            };

            await _unitOfWork.Venues.AddAsync(venue);
            await _unitOfWork.SaveChangesAsync();

            return venue.Id;
        }

        public async Task UpdateAsync(Guid id, UpdateVenueDto dto)
        {
            var venue = await _unitOfWork.Venues.GetByIdAsync(id);
            if (venue == null)
            {
                throw new ArgumentException("Venue not found");
            }

            venue.Name = dto.Name;
            venue.Description = dto.Description;
            venue.Address = dto.Address;
            venue.City = dto.City;
            venue.Country = dto.Country;
            venue.Latitude = dto.Latitude;
            venue.Longitude = dto.Longitude;
            venue.Capacity = dto.Capacity;
            venue.ContactEmail = dto.ContactEmail;
            venue.PhoneNumber = dto.PhoneNumber;
            venue.ImageUrl = dto.ImageUrl;
            venue.ImageUrls = dto.ImageUrls != null ? JsonSerializer.Serialize(dto.ImageUrls) : null;

            await _unitOfWork.Venues.UpdateAsync(venue);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid id)
        {
            var venue = await _unitOfWork.Venues.GetByIdAsync(id);
            if (venue == null)
            {
                return;
            }

            await _unitOfWork.Venues.DeleteAsync(venue);
            await _unitOfWork.SaveChangesAsync();
        }

        private static VenueDto MapToDto(Venue venue) => new VenueDto
        {
            Id = venue.Id,
            Name = venue.Name,
            Description = venue.Description,
            Address = venue.Address,
            City = venue.City,
            Country = venue.Country,
            Latitude = venue.Latitude,
            Longitude = venue.Longitude,
            Capacity = venue.Capacity,
            ContactEmail = venue.ContactEmail,
            PhoneNumber = venue.PhoneNumber,
            ImageUrl = venue.ImageUrl,
            ImageUrls = !string.IsNullOrEmpty(venue.ImageUrls)
                ? JsonSerializer.Deserialize<List<string>>(venue.ImageUrls)
                : null
        };
    }
}
