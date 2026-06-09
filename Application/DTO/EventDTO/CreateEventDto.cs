namespace DJDiP.Application.DTO.EventDTO
{
    public class CreateEventDto
    {
        public string Title { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public Guid VenueId { get; set; }
        public decimal Price { get; set; }
        public string Description { get; set; } = string.Empty;
        public List<Guid> GenreIds { get; set; } = new();
        public List<Guid> DJIds { get; set; } = new();
        public string? ImageUrl { get; set; }
        public string? VideoUrl { get; set; }
        public string? TicketingUrl { get; set; }
    }
}
