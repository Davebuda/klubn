using Microsoft.EntityFrameworkCore;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models.AdmnModels;

namespace DJDiP.Infrastructure.Persistance.Repositories
{
    // Append-only. No Update/Delete on purpose (WS2 / TM-1) — a tamper-evident trail. The
    // SaveChanges is the caller's (IUnitOfWork) so the audit write commits on its own, never
    // inside a payment transaction.
    public class AuditLogRepository : IAuditLogRepository
    {
        private readonly AppDbContext _context;

        public AuditLogRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(AuditLog entry)
        {
            await _context.AuditLogs.AddAsync(entry);
        }

        public async Task<IReadOnlyList<AuditLog>> QueryAsync(
            string? entityName = null,
            string? entityId = null,
            string? userId = null,
            int skip = 0,
            int take = 100)
        {
            var query = _context.AuditLogs.AsNoTracking().AsQueryable();

            if (!string.IsNullOrEmpty(entityName))
                query = query.Where(a => a.EntityName == entityName);
            if (!string.IsNullOrEmpty(entityId))
                query = query.Where(a => a.EntityId == entityId);
            if (!string.IsNullOrEmpty(userId))
                query = query.Where(a => a.UserId == userId);

            return await query
                .OrderByDescending(a => a.Timestamp)
                .Skip(skip)
                .Take(take)
                .ToListAsync();
        }
    }
}
