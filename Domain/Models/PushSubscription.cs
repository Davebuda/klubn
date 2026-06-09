namespace DJDiP.Domain.Models
{
    public class PushSubscription
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public required string Endpoint { get; set; }
        public required string P256dh { get; set; }
        public required string Auth { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ApplicationUser User { get; set; } = null!;
    }
}
