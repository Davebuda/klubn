namespace Application.DTO.NotificationDTO
{
    public class CreateNotificationDto
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
    }
}