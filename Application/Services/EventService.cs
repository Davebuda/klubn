using System.Text.Json;
using DJDiP.Application.Interfaces;
using DJDiP.Application.DTO.EventDTO;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class EventService : IEventService
    {
        private readonly IUnitOfWork _unitOfWork;

        public EventService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<EventListDto>> GetAllAsync()
        {
            var events = await _unitOfWork.Events.GetAllAsync();
            return events
                .Where(e => e.Status == "Published")
                .Select(e => new EventListDto
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Date = e.Date,
                Price = e.Price,
                ImageUrl = e.ImageUrl,
                TicketingUrl = e.TicketingUrl,
                Status = e.Status,
                OrganizerId = e.OrganizerId,
                Genres = e.Genres.Select(g => g.Name).ToList(),
                Venue = new EventVenueDto
                {
                    Id = e.Venue.Id,
                    Name = e.Venue.Name,
                    City = e.Venue.City,
                    ImageUrl = e.Venue.ImageUrl,
                    ImageUrls = !string.IsNullOrEmpty(e.Venue.ImageUrls)
                        ? JsonSerializer.Deserialize<List<string>>(e.Venue.ImageUrls)
                        : null
                }
            }).ToList();
        }

        public async Task<DetailEventDto?> GetByIdAsync(Guid id)
        {
            var ev = await _unitOfWork.Events.GetByIdAsync(id);
            if (ev == null) return null;

            return new DetailEventDto
            {
                Id = ev.Id,
                Title = ev.Title,
                Date = ev.Date,
                VenueId = ev.Venue.Id,
                Price = ev.Price,
                Description = ev.Description,
                GenreIds = ev.Genres.Select(g => g.Id).ToList(),
                DJIds = ev.EventDJs.Select(d => d.DJId).ToList(),
                ImageUrl = ev.ImageUrl,
                VideoUrl = ev.VideoUrl,
                TicketingUrl = ev.TicketingUrl,
                Venue = new EventVenueDto
                {
                    Id = ev.Venue.Id,
                    Name = ev.Venue.Name,
                    Description = ev.Venue.Description,
                    Address = ev.Venue.Address,
                    City = ev.Venue.City,
                    Country = ev.Venue.Country,
                    ImageUrl = ev.Venue.ImageUrl,
                    ImageUrls = !string.IsNullOrEmpty(ev.Venue.ImageUrls)
                        ? JsonSerializer.Deserialize<List<string>>(ev.Venue.ImageUrls)
                        : null
                }
            };
        }

        public async Task<Guid> CreateAsync(CreateEventDto dto)
        {
            var ev = new Event
            {
                Id = Guid.NewGuid(),
                Title = dto.Title,
                Date = dto.Date,
                VenueId = dto.VenueId, // Set VenueId (required)
                Price = dto.Price,
                Description = dto.Description,
                ImageUrl = dto.ImageUrl,
                VideoUrl = dto.VideoUrl,
                TicketingUrl = dto.TicketingUrl
            };

            // Associate Genres
            if (dto.GenreIds != null && dto.GenreIds.Any())
            {
                var genres = await _unitOfWork.Genres.GetAllAsync();
                ev.Genres = genres.Where(g => dto.GenreIds.Contains(g.Id)).ToList();
            }

            // Associate DJs through EventDJ join table
            if (dto.DJIds != null && dto.DJIds.Any())
            {
                ev.EventDJs = dto.DJIds.Select(djId => new EventDJ
                {
                    EventId = ev.Id,
                    DJId = djId
                }).ToList();
            }

            await _unitOfWork.Events.AddAsync(ev);
            await _unitOfWork.SaveChangesAsync();
            return ev.Id;
        }

        public async Task UpdateAsync(Guid id, UpdateEventDto dto)
        {
            var ev = await _unitOfWork.Events.GetByIdAsync(id);
            if (ev == null) throw new ArgumentException("Event not found");

            ev.Title = dto.Title;
            ev.Date = dto.Date;
            ev.VenueId = dto.VenueId; // Update VenueId
            ev.Price = dto.Price;
            ev.Description = dto.Description;
            ev.ImageUrl = dto.ImageUrl;
            ev.VideoUrl = dto.VideoUrl;
            ev.TicketingUrl = dto.TicketingUrl;

            // Update Genres
            if (dto.GenreIds != null)
            {
                var genres = await _unitOfWork.Genres.GetAllAsync();
                ev.Genres = genres.Where(g => dto.GenreIds.Contains(g.Id)).ToList();
            }

            // Update DJs - clear existing and add new
            if (dto.DJIds != null)
            {
                ev.EventDJs.Clear();
                ev.EventDJs = dto.DJIds.Select(djId => new EventDJ
                {
                    EventId = ev.Id,
                    DJId = djId
                }).ToList();
            }

            await _unitOfWork.Events.UpdateAsync(ev);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid id)
        {
            var ev = await _unitOfWork.Events.GetByIdAsync(id);
            if (ev == null) return;
            await _unitOfWork.Events.DeleteAsync(ev);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
