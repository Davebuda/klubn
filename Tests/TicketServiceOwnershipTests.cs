using DJDiP.Application.DTO.TicketDTO;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS1 (IDOR #1 cancelTicket, #2 transferTicket): ownership is enforced INSIDE the
    // service so both GraphQL and REST inherit it. These tests drive CancelTicketAsync /
    // TransferTicketAsync directly with a JWT caller threaded through the DTO and assert:
    //   - cross-user caller -> UnauthorizedAccessException, NO mutation (UpdateCount == 0).
    //   - owner / manager     -> action succeeds (UpdateCount == 1, state changed).
    public class TicketServiceOwnershipTests
    {
        private const string OwnerId = "user-A";
        private const string AttackerId = "user-B";

        private static Ticket ActiveTicket(string ownerId) => new()
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid(),
            UserId = ownerId,
            TicketNumber = "TKT-TEST-00001",
            QRCode = "QR-ORIGINAL",
            Status = TicketStatus.Active,
            IsValid = true,
            IsUsed = false,
            Event = new Event { Id = Guid.NewGuid(), Title = "Test Night", Date = DateTime.UtcNow.AddDays(7) }
        };

        private static TicketService Service(FakeTicketRepository tickets, FakeUserRepository? users = null)
        {
            var uow = new AuthzUnitOfWork(
                tickets: tickets,
                users: users ?? new FakeUserRepository(),
                audit: new FakeAuditLogRepository());
            return new TicketService(uow, new NoopEmailService(), new UnusedPaymentProvider(),
                new AuditLogService(uow), NullLogger<TicketService>.Instance);
        }

        // ---- cancelTicket ----------------------------------------------------------

        [Fact]
        public async Task CancelTicket_by_non_owner_non_manager_is_denied_and_does_not_mutate()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var svc = Service(repo);

            var dto = new CancelTicketDto
            {
                TicketId = ticket.Id,
                Reason = "I want this gone",
                ActingUserId = AttackerId,   // not the owner
                IsManager = false
            };

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => svc.CancelTicketAsync(dto));
            Assert.Equal(0, repo.UpdateCount);               // no write happened
            Assert.Equal(TicketStatus.Active, ticket.Status); // unchanged
            Assert.True(ticket.IsValid);
        }

        [Fact]
        public async Task CancelTicket_by_owner_succeeds()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var svc = Service(repo);

            var dto = new CancelTicketDto
            {
                TicketId = ticket.Id,
                Reason = "Change of plans",
                ActingUserId = OwnerId,
                IsManager = false
            };

            var result = await svc.CancelTicketAsync(dto);

            Assert.NotNull(result);
            Assert.Equal(1, repo.UpdateCount);
            Assert.Equal(TicketStatus.Cancelled, ticket.Status);
            Assert.False(ticket.IsValid);
        }

        [Fact]
        public async Task CancelTicket_by_manager_for_another_users_ticket_succeeds()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var svc = Service(repo);

            var dto = new CancelTicketDto
            {
                TicketId = ticket.Id,
                Reason = "Admin action",
                ActingUserId = AttackerId,   // not the owner...
                IsManager = true             // ...but a manager
            };

            var result = await svc.CancelTicketAsync(dto);

            Assert.NotNull(result);
            Assert.Equal(TicketStatus.Cancelled, ticket.Status);
        }

        // ---- transferTicket --------------------------------------------------------

        [Fact]
        public async Task TransferTicket_by_non_owner_is_denied_and_ownership_and_qr_unchanged()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            // The target user EXISTS, to prove the denial is about the CALLER, not the target.
            var users = new FakeUserRepository(new ApplicationUser { Id = AttackerId, Email = "b@test.local", FullName = "B" });
            var svc = Service(repo, users);

            var dto = new TransferTicketDto
            {
                TicketId = ticket.Id,
                ToUserId = AttackerId,
                ToEmail = "b@test.local",
                ActingUserId = AttackerId,   // attacker tries to steal A's ticket to themselves
                IsManager = false
            };

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => svc.TransferTicketAsync(dto));
            Assert.Equal(0, repo.UpdateCount);
            Assert.Equal(OwnerId, ticket.UserId);        // ownership unchanged
            Assert.Equal("QR-ORIGINAL", ticket.QRCode);  // QR not rotated
            Assert.Equal(TicketStatus.Active, ticket.Status);
        }

        [Fact]
        public async Task TransferTicket_by_owner_succeeds_and_rotates_qr()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var users = new FakeUserRepository(new ApplicationUser { Id = AttackerId, Email = "b@test.local", FullName = "B" });
            var svc = Service(repo, users);

            var dto = new TransferTicketDto
            {
                TicketId = ticket.Id,
                ToUserId = AttackerId,       // here "B" is a legitimate recipient
                ToEmail = "b@test.local",
                ActingUserId = OwnerId,      // the real owner initiates
                IsManager = false
            };

            var result = await svc.TransferTicketAsync(dto);

            Assert.NotNull(result);
            Assert.Equal(AttackerId, ticket.UserId);     // ownership moved
            Assert.Equal(OwnerId, ticket.TransferredFromUserId);
            Assert.NotEqual("QR-ORIGINAL", ticket.QRCode); // new QR issued
        }
    }
}
