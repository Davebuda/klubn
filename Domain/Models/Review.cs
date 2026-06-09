namespace DJDiP.Domain.Models
{
    public class Review
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int Rating { get; set; } // 1-5
        public string? Comment { get; set; }
        public bool IsVerifiedAttendee { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Event Event { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
