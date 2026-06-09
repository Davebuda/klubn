
namespace DJDiP.Domain.Models
{
    public class Notification
    {
        public Guid Id { get; set; }
        public string UserId { get; set; }
        public ApplicationUser User { get; set; } = null!;
        public string Type { get; set; } = null!; // e.g., "Email", "SMS"
        public string Message { get; set; } = null!;
        public DateTime SentAt { get; set; }
        public bool IsRead { get; set; }
    }
}