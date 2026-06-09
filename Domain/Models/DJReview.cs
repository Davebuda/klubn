namespace DJDiP.Domain.Models
{
    public class DJReview
    {
        public Guid Id { get; set; }
        public Guid DJId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int Rating { get; set; } // 1-5
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public DJProfile DJ { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
    }
}
