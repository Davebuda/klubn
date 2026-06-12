using DJDiP.Application.DTO.AuditLogDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using Xunit;

namespace DJDiP.Tests
{
    // WS2 Phase 1 — audit-trail FOUNDATION tests. These drive AuditLogService against the
    // in-memory FakeAuditLogRepository (no DB) and pin the three invariants the plan requires:
    // fields persist + server timestamp, append-only, and filterable query.
    public class AuditLogServiceTests
    {
        private static (AuditLogService svc, FakeAuditLogRepository repo) NewService()
        {
            var repo = new FakeAuditLogRepository();
            var uow = new AuthzUnitOfWork(audit: repo);
            return (new AuditLogService(uow), repo);
        }

        [Fact]
        public async Task RecordAsync_persists_all_fields_and_sets_server_timestamp()
        {
            var (svc, repo) = NewService();

            await svc.RecordAsync(new CreateAuditLogDTO
            {
                Action = "RoleChange",
                EntityName = "ApplicationUser",
                EntityId = "user-123",
                UserId = "admin-1",
                Changes = "{\"oldRole\":0,\"newRole\":2}"
            });

            var row = Assert.Single(repo.Rows);
            Assert.Equal("RoleChange", row.Action);
            Assert.Equal("ApplicationUser", row.EntityName);
            Assert.Equal("user-123", row.EntityId);
            Assert.Equal("admin-1", row.UserId);
            Assert.Equal("{\"oldRole\":0,\"newRole\":2}", row.Changes);

            // Id and Timestamp are assigned by the SERVICE, not the caller's DTO.
            Assert.NotEqual(Guid.Empty, row.Id);
            Assert.NotEqual(default, row.Timestamp);
            Assert.Equal(DateTimeKind.Utc, row.Timestamp.Kind);
            Assert.True((DateTime.UtcNow - row.Timestamp).TotalMinutes < 1, "timestamp should be 'now' in UTC");
        }

        [Fact]
        public async Task RecordAsync_is_append_only()
        {
            var (svc, repo) = NewService();

            await svc.RecordAsync(new CreateAuditLogDTO { Action = "TicketRefund", EntityName = "Ticket", EntityId = "t1", UserId = "admin-1" });
            await svc.RecordAsync(new CreateAuditLogDTO { Action = "TicketRefund", EntityName = "Ticket", EntityId = "t1", UserId = "admin-1" });

            // Two records of the "same" action produce two distinct rows — never an overwrite.
            Assert.Equal(2, repo.Rows.Count);
            Assert.NotEqual(repo.Rows[0].Id, repo.Rows[1].Id);

            // The append-only guarantee is structural: the repository contract exposes no
            // mutation/removal surface. Pin it so a future regression is caught at compile/test time.
            var methods = typeof(IAuditLogRepository).GetMethods().Select(m => m.Name).ToArray();
            Assert.DoesNotContain("UpdateAsync", methods);
            Assert.DoesNotContain("DeleteAsync", methods);
            Assert.DoesNotContain("RemoveAsync", methods);
        }

        [Fact]
        public async Task QueryAsync_filters_by_entity_and_actor()
        {
            var (svc, _) = NewService();
            await svc.RecordAsync(new CreateAuditLogDTO { Action = "TicketTransfer", EntityName = "Ticket", EntityId = "t1", UserId = "admin-1" });
            await svc.RecordAsync(new CreateAuditLogDTO { Action = "TicketTransfer", EntityName = "Ticket", EntityId = "t2", UserId = "admin-2" });
            await svc.RecordAsync(new CreateAuditLogDTO { Action = "RoleChange", EntityName = "ApplicationUser", EntityId = "u9", UserId = "admin-1" });

            // by exact target resource
            var byEntity = await svc.QueryAsync(new AuditLogFilter { EntityName = "Ticket", EntityId = "t1" });
            Assert.Single(byEntity);
            Assert.Equal("t1", byEntity[0].EntityId);
            Assert.Equal("admin-1", byEntity[0].UserId);

            // by actor — spans entity types
            var byActor = await svc.QueryAsync(new AuditLogFilter { UserId = "admin-1" });
            Assert.Equal(2, byActor.Count);
            Assert.All(byActor, r => Assert.Equal("admin-1", r.UserId));

            // by entity type only
            var byType = await svc.QueryAsync(new AuditLogFilter { EntityName = "ApplicationUser" });
            Assert.Single(byType);
            Assert.Equal("RoleChange", byType[0].Action);

            // empty filter returns everything
            var all = await svc.QueryAsync(new AuditLogFilter());
            Assert.Equal(3, all.Count);
        }
    }
}
