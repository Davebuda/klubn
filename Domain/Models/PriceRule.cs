namespace DJDiP.Domain.Models
{
    public class PriceRule
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public required string RuleName { get; set; }
        public decimal Multiplier { get; set; } = 1.0m;
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? TicketsRemainingThreshold { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Event Event { get; set; } = null!;
    }
}
