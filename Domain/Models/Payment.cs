namespace DJDiP.Domain.Models
{
    public class Payment
    {
        public Guid Id { get; set; }
        public Guid OrderId { get; set; }
        public Order Order { get; set; } = null!;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "NOK"; 
        public string PaymentMethod { get; set; } = null!;
        public string? TransactionId { get; set; }

        
        public Guid? PromotionCodeId { get; set; }
        public PromotionCode? PromotionCode { get; set; }

        public DateTime PaymentDate { get; set; }
        public PaymentStatus Status { get; set; }
    }
}