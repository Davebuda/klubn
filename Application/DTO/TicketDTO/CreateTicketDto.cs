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

        // P0-WS1 (IDOR): the JWT-derived caller and whether they are Admin/CoAdmin.
        // Ownership is enforced INSIDE the service so REST inherits the check.
        public string ActingUserId { get; set; } = string.Empty;
        public bool IsManager { get; set; }
    }

    public class RefundTicketDto
    {
        public Guid TicketId { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;

        // P0-WS2 (audit): the JWT-derived caller (manager) who performed the refund. The
        // audit actor is ALWAYS this id — never input.UserId. Set in the resolver from
        // RequireCoAdmin's return value.
        public string ActingUserId { get; set; } = string.Empty;
    }

    public class TransferTicketDto
    {
        public Guid TicketId { get; set; }
        public string ToUserId { get; set; } = string.Empty;
        public string ToEmail { get; set; } = string.Empty;

        // P0-WS1 (IDOR): the JWT-derived caller and whether they are Admin/CoAdmin.
        // Only the current owner (or a manager) may transfer — enforced in the service.
        public string ActingUserId { get; set; } = string.Empty;
        public bool IsManager { get; set; }
    }
}