namespace DJDiP.Domain.Models
{
    public class ServiceBooking
    {
        public Guid Id { get; set; }
        public Guid ServiceId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public DateTime BookingDate { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Confirmed, Completed, Cancelled
        public decimal TotalAmount { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Service Service { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
