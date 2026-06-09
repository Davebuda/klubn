namespace DJDiP.Domain.Models
{
    public class ServiceReview
    {
        public Guid Id { get; set; }
        public Guid ServiceId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int Rating { get; set; } // 1-5
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Service Service { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
