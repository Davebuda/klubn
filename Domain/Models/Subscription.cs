namespace DJDiP.Domain.Models
{
    public class Subscription
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int Tier { get; set; } // 0=Free, 1=Plus, 2=Premium
        public decimal Price { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int Status { get; set; } // 0=Active, 1=Cancelled, 2=Expired
        public bool AutoRenew { get; set; } = true;
        public string? PaymentMethod { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ApplicationUser User { get; set; } = null!;
    }
}
