using DJDiP.Domain.Models.AdmnModels;

namespace DJDiP.Application.Interfaces
{
    // WS2 / TM-1: the audit store is intentionally APPEND-ONLY. It exposes AddAsync and read
    // queries only — no Update, no Delete — so the privileged-action trail is tamper-evident.
    // SaveChanges is the caller's responsibility (via IUnitOfWork) so an audit write is its own
    // commit and is never folded into a payment capture/issue transaction.
    public interface IAuditLogRepository
    {
        Task AddAsync(AuditLog entry);

        Task<IReadOnlyList<AuditLog>> QueryAsync(
            string? entityName = null,
            string? entityId = null,
            string? userId = null,
            int skip = 0,
            int take = 100);
    }
}
