namespace DJDiP.Application.DTO.EventDTO
{
    public class EventListDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }
        public string? TicketingUrl { get; set; }
        public EventVenueDto Venue { get; set; } = null!;
        public List<string> Genres { get; set; } = new();
        public string Status { get; set; } = "Published";
        public string? StatusReason { get; set; }
        public string? OrganizerId { get; set; }
    }

    public class EventVenueDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public List<string>? ImageUrls { get; set; }
    }
}
