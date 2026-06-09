namespace Application.DTO.OrderDTO
{
    public class OrderDto
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? PromotionCode { get; set; }

        public decimal TotalAmount { get; set; }
        public bool IsPaid { get; set; } // Kan utledes fra om Payment finnes
    }
}