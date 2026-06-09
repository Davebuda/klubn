namespace DJDiP.Application.DTO.ContactMessageDTO
{
    public class ContactMessageReadDto
    {
        public Guid Id { get; set; }
        public required string Message { get; set; }
        public required string UserFullName { get; set; }  // Optional: useful for admin views
        public DateTime CreatedAt { get; set; }
    }
}
