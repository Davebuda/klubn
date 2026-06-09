namespace DJDiP.Application.DTO.TicketDTO
{
    public class CreateTicketDto
    {
        public Guid EventId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public bool TermsAccepted { get; set; }
        public string Email { get; set; } = string.Empty;
    }

    public class CancelTicketDto
    {
        public Guid TicketId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class RefundTicketDto
    {
        public Guid TicketId { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
    }

    public class TransferTicketDto
    {
        public Guid TicketId { get; set; }
        public string ToUserId { get; set; } = string.Empty;
        public string ToEmail { get; set; } = string.Empty;
    }
}