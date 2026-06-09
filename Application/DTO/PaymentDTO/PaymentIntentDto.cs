namespace DJDiP.Application.DTO.PaymentDTO
{
    public class PaymentIntentDto
    {
        public string PaymentIntentId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
        public long Amount { get; set; } // Amount in øre (smallest currency unit)
        public string Currency { get; set; } = "nok"; // Norwegian Kroner
    }

    public class CreatePaymentIntentDto
    {
        public Guid EventId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }

    public class ConfirmPaymentDto
    {
        public string PaymentIntentId { get; set; } = string.Empty;
        public Guid EventId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}
