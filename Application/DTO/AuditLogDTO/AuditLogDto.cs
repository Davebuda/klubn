namespace DJDiP.Application.DTO.AuditLogDTO
{
    public class AuditLogDTO
    {
        public Guid Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string Action { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string? Changes { get; set; }
    }

    public class CreateAuditLogDTO
    {
        public string Action { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string? Changes { get; set; }
    }
}
