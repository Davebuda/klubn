namespace DJDiP.Application.DTO.PaymentDTO
{
    public class CreatePaymentDto
    {
        public Guid OrderId { get; set; }
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = string.Empty; // "CreditCard", "PayPal", etc.
        public string TransactionId { get; set; } = string.Empty;
        public DateTime PaymentDate { get; set; }
        public string Status { get; set; } = string.Empty; // "Pending", "Completed", "Failed"
    }
}