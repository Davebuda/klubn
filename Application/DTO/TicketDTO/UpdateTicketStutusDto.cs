namespace Application.DTO.TicketDTO
{
public class UpdateTicketStatusDto
{
    public Guid TicketId { get; set; }
    public bool IsValid { get; set; }
    public DateTime? CheckInTime { get; set; }
}
}