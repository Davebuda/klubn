using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using DJDiP.Infrastructure.Persistance;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS3C (GDPR Art. 15/17/20). AnonymizeUserAsync scrubs identity but RETAINS financial
    // rows; it writes a "UserErasure" audit row (actor==target for self-erasure). ExportUserDataAsync
    // is owner-scoped by the passed id. The User->Order/Ticket FK delete behavior is Restrict.
    public class UserServiceErasureTests
    {
        private const string UserA = "user-A";
        private const string UserB = "user-B";

        private static ApplicationUser Seed(string id, string email)
            => new() { Id = id, Email = email, FullName = "Real Name", ProfilePictureUrl = "/pic.jpg",
                       EmailVerificationToken = "tok", PasswordResetToken = "rst" };

        [Fact]
        public async Task Erasure_AnonymizesUserButRetainsFinancialRows()
        {
            var user = Seed(UserA, "real@user.local");
            var order = new Order { Id = Guid.NewGuid(), UserId = UserA, Reference = "klubn-x", TotalAmount = 100m };
            var ticket = new Ticket { Id = Guid.NewGuid(), UserId = UserA, EventId = Guid.NewGuid() };

            var users = new GdprUserRepository(user);
            var tickets = new GdprTicketRepository(ticket);
            var orders = new GdprOrderRepository(order);
            var audit = new FakeAuditLogRepository();
            var uow = new GdprUnitOfWork(users, tickets, orders, audit);
            var svc = new UserService(uow, new AuditLogService(uow));

            var ok = await svc.AnonymizeUserAsync(actorId: UserA, targetUserId: UserA);

            Assert.True(ok);
            // PII scrubbed / pseudonymized.
            Assert.NotEqual("real@user.local", user.Email);
            Assert.StartsWith("anonymized+", user.Email);
            Assert.EndsWith("@deleted.invalid", user.Email);
            Assert.Equal("Deleted user", user.FullName);
            Assert.Null(user.ProfilePictureUrl);
            Assert.Null(user.EmailVerificationToken);
            Assert.Null(user.PasswordResetToken);

            // Financial rows are NOT deleted/mutated by anonymize.
            Assert.False(tickets.MutatedOrDeleted);
            Assert.False(orders.MutatedOrDeleted);
            Assert.Single(tickets.All);
            Assert.Single(orders.All);
        }

        [Fact]
        public async Task Erasure_WritesAuditRow()
        {
            var user = Seed(UserA, "real@user.local");
            var audit = new FakeAuditLogRepository();
            var uow = new GdprUnitOfWork(new GdprUserRepository(user), new GdprTicketRepository(),
                                         new GdprOrderRepository(), audit);
            var svc = new UserService(uow, new AuditLogService(uow));

            await svc.AnonymizeUserAsync(actorId: UserA, targetUserId: UserA);

            var row = Assert.Single(audit.Rows);
            Assert.Equal("UserErasure", row.Action);
            Assert.Equal("ApplicationUser", row.EntityName);
            Assert.Equal(UserA, row.EntityId);
            // Self-erasure: actor == target.
            Assert.Equal(UserA, row.UserId);
        }

        [Fact]
        public async Task Erasure_UnknownUser_ReturnsFalseAndWritesNoAudit()
        {
            var audit = new FakeAuditLogRepository();
            var uow = new GdprUnitOfWork(new GdprUserRepository(), new GdprTicketRepository(),
                                         new GdprOrderRepository(), audit);
            var svc = new UserService(uow, new AuditLogService(uow));

            var ok = await svc.AnonymizeUserAsync("admin-1", "does-not-exist");

            Assert.False(ok);
            Assert.Empty(audit.Rows);
        }

        [Fact]
        public async Task Export_ReturnsOnlyCallersOwnData()
        {
            var userA = Seed(UserA, "a@user.local");
            var userB = Seed(UserB, "b@user.local");
            var aTicket = new Ticket { Id = Guid.NewGuid(), UserId = UserA, EventId = Guid.NewGuid(), TicketNumber = "A-1" };
            var bTicket = new Ticket { Id = Guid.NewGuid(), UserId = UserB, EventId = Guid.NewGuid(), TicketNumber = "B-1" };
            var aOrder = new Order { Id = Guid.NewGuid(), UserId = UserA, Reference = "klubn-a" };
            var bOrder = new Order { Id = Guid.NewGuid(), UserId = UserB, Reference = "klubn-b" };

            var uow = new GdprUnitOfWork(
                new GdprUserRepository(userA, userB),
                new GdprTicketRepository(aTicket, bTicket),
                new GdprOrderRepository(aOrder, bOrder),
                new FakeAuditLogRepository());
            var svc = new UserService(uow, new AuditLogService(uow));

            // Export is scoped purely by the passed id — there is no path to request B's data
            // from an A-scoped call. Calling with A returns ONLY A's rows.
            var export = await svc.ExportUserDataAsync(UserA);

            Assert.NotNull(export);
            Assert.Equal(UserA, export!.Profile.Id);
            Assert.Equal("a@user.local", export.Profile.Email);
            Assert.Single(export.Tickets);
            Assert.Equal("A-1", export.Tickets[0].TicketNumber);
            Assert.Single(export.Orders);
            Assert.Equal("klubn-a", export.Orders[0].Reference);
            // Nothing belonging to B leaked.
            Assert.DoesNotContain(export.Tickets, t => t.TicketNumber == "B-1");
            Assert.DoesNotContain(export.Orders, o => o.Reference == "klubn-b");
        }

        [Fact]
        public void Erasure_FinancialFkIsRestrictNotCascade()
        {
            // Model-level assertion: the User->Order and User->Ticket FK delete behaviors are
            // Restrict (not Cascade) so anonymize/delete can never cascade away financial rows.
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("DataSource=:memory:")
                .Options;
            using var db = new AppDbContext(options);
            var model = db.Model;

            foreach (var entityType in new[] { typeof(Order), typeof(Ticket) })
            {
                var et = model.FindEntityType(entityType)!;
                var userFk = et.GetForeignKeys()
                    .Single(fk => fk.PrincipalEntityType.ClrType == typeof(ApplicationUser));
                Assert.Equal(DeleteBehavior.Restrict, userFk.DeleteBehavior);
            }
        }
    }
}
