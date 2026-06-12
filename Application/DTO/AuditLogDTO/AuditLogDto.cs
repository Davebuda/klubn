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

    // WS2: filter for the Admin audit-log read query (Phase 3). Null fields = no filter.
    public class AuditLogFilter
    {
        public string? EntityName { get; set; }
        public string? EntityId { get; set; }
        public string? UserId { get; set; }
        public int Skip { get; set; } = 0;
        public int Take { get; set; } = 100;
    }
}
