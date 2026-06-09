namespace DJDiP.Domain.Models
{
    public class Venue
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        public int Capacity { get; set; }
        public string ContactEmail { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }

        public string? ImageUrl { get; set; }
        public string? ImageUrls { get; set; }

        public List<Event> Events { get; set; } = new();
    }
}
