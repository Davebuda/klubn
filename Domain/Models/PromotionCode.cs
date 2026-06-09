namespace DJDiP.Domain.Models
{
    public class PromotionCode
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = null!;
        public decimal DiscountPercentage { get; set; } // e.g., 15 means 15%
        public DateTime ValidUntil { get; set; }
        public int UsageCount { get; set; }
    }
}