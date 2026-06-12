using DJDiP.Application.DTO.AuditLogDTO;

namespace DJDiP.Application.Interfaces
{
    // WS2 (TM-1): records one attributable, append-only audit row per privileged action.
    // The actor (UserId) MUST be the JWT-derived id supplied by the caller — never client input.
    public interface IAuditLogService
    {
        Task RecordAsync(CreateAuditLogDTO entry, CancellationToken ct = default);

        Task<IReadOnlyList<AuditLogDTO>> QueryAsync(AuditLogFilter filter, CancellationToken ct = default);
    }
}
