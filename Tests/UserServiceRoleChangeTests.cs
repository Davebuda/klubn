using System.Text.Json;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS2 Phase 2 — role-change audit. ChangeRoleAsync was extracted to UserService for
    // unit-testability. These assert ONE attributable audit row on a successful change, that the
    // actor is the admin (never the target), and that an unknown target writes NO row.
    public class UserServiceRoleChangeTests
    {
        private const string AdminId = "admin-1";
        private const string TargetId = "user-T";

        private static (UserService svc, FakeAuditLogRepository audit) Service(params ApplicationUser[] users)
        {
            var fakeUsers = new FakeUserRepository(users);
            var audit = new FakeAuditLogRepository();
            var uow = new AuthzUnitOfWork(users: fakeUsers, audit: audit);
            return (new UserService(uow, new AuditLogService(uow)), audit);
        }

        [Fact]
        public async Task ChangeRole_writes_audit_with_old_and_new_role()
        {
            var target = new ApplicationUser { Id = TargetId, Email = "t@test.local", FullName = "T", Role = 0 };
            var (svc, audit) = Service(target);

            var ok = await svc.ChangeRoleAsync(AdminId, TargetId, newRole: 1);

            Assert.True(ok);
            Assert.Equal(1, target.Role);   // mutation applied

            var row = Assert.Single(audit.Rows);
            Assert.Equal("RoleChange", row.Action);
            Assert.Equal("ApplicationUser", row.EntityName);
            Assert.Equal(TargetId, row.EntityId);
            Assert.NotNull(row.Changes);

            using var doc = JsonDocument.Parse(row.Changes!);
            Assert.Equal(0, doc.RootElement.GetProperty("oldRole").GetInt32());
            Assert.Equal(1, doc.RootElement.GetProperty("newRole").GetInt32());
            Assert.Equal(TargetId, doc.RootElement.GetProperty("targetUserId").GetString());
        }

        [Fact]
        public async Task ChangeRole_audit_actor_is_admin_not_target()
        {
            var target = new ApplicationUser { Id = TargetId, Email = "t@test.local", FullName = "T", Role = 0 };
            var (svc, audit) = Service(target);

            await svc.ChangeRoleAsync(AdminId, TargetId, newRole: 2);

            var row = Assert.Single(audit.Rows);
            Assert.Equal(AdminId, row.UserId);        // actor == admin
            Assert.NotEqual(TargetId, row.UserId);    // actor != target
        }

        [Fact]
        public async Task ChangeRole_unknown_user_returns_false_and_writes_no_audit()
        {
            var (svc, audit) = Service();   // no users seeded

            var ok = await svc.ChangeRoleAsync(AdminId, "does-not-exist", newRole: 1);

            Assert.False(ok);
            Assert.Empty(audit.Rows);   // no row for a non-existent target
        }
    }
}
