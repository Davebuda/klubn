using DJDiP.Application.DTO.AuditLogDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models.AdmnModels;

namespace DJDiP.Application.Services
{
    // WS2 foundation. Writes one append-only audit row per privileged action with its OWN
    // SaveChanges — never inside a PaymentOrchestrator/capture/issue transaction (the payment
    // engine is left untouched). Id and Timestamp are set server-side here and are never
    // trusted from the caller. Changes must carry ids + amounts only (PCI SAQ-A / GDPR: no
    // card data, tokens, passwords, or raw PII — the caller is responsible for that contract).
    public class AuditLogService : IAuditLogService
    {
        private readonly IUnitOfWork _unitOfWork;

        public AuditLogService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task RecordAsync(CreateAuditLogDTO entry, CancellationToken ct = default)
        {
            var log = new AuditLog
            {
                Id = Guid.NewGuid(),
                Timestamp = DateTime.UtcNow,   // server clock — never client-supplied
                Action = entry.Action,
                EntityName = entry.EntityName,
                EntityId = entry.EntityId,
                UserId = entry.UserId,
                Changes = entry.Changes
            };

            await _unitOfWork.AuditLogs.AddAsync(log);
            await _unitOfWork.SaveChangesAsync();   // own, isolated commit
        }

        public async Task<IReadOnlyList<AuditLogDTO>> QueryAsync(AuditLogFilter filter, CancellationToken ct = default)
        {
            var rows = await _unitOfWork.AuditLogs.QueryAsync(
                filter.EntityName, filter.EntityId, filter.UserId, filter.Skip, filter.Take);

            return rows.Select(Map).ToList();
        }

        private static AuditLogDTO Map(AuditLog a) => new()
        {
            Id = a.Id,
            Timestamp = a.Timestamp,
            Action = a.Action,
            EntityName = a.EntityName,
            EntityId = a.EntityId,
            UserId = a.UserId,
            Changes = a.Changes
        };
    }
}
