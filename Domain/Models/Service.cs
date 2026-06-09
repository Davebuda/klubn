namespace DJDiP.Domain.Models
{
    public class Service
    {
        public Guid Id { get; set; }
        public required string Title { get; set; }
        public required string Description { get; set; }
        public string? Category { get; set; }
        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }
        public bool IsFeatured { get; set; } = false;
        public string? Slug { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public List<ServiceBooking> Bookings { get; set; } = new();
        public List<ServiceReview> Reviews { get; set; } = new();
    }
}
