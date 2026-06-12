using System.Text.Json;
using DJDiP.Application.DTO.TicketDTO;
using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS2 Phase 2 — audit trail for Tier-1 ticket ops. These drive TicketService directly
    // and assert ONE attributable, append-only audit row per SUCCESSFUL privileged op, that the
    // actor is the JWT caller (never the recipient), that a denied op writes NO row, and that the
    // refund audit carries amounts/ids ONLY (no card/PAN/token data). The refund tests use the
    // OrderItemId=null path so the payment provider is never touched.
    public class TicketServiceAuditTests
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

        private static Ticket CancelledTicket(string ownerId, decimal totalPrice) => new()
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid(),
            UserId = ownerId,
            TicketNumber = "TKT-TEST-00002",
            QRCode = "QR-ORIGINAL",
            Status = TicketStatus.Cancelled,   // refund precondition
            OrderItemId = null,                // forces the local-marker branch (no provider call)
            TotalPrice = totalPrice,
            IsValid = false,
            IsUsed = false,
            Event = new Event { Id = Guid.NewGuid(), Title = "Test Night", Date = DateTime.UtcNow.AddDays(7) }
        };

        // Returns (service, ticketRepo, auditRepo, paymentProvider) so a test can assert on the
        // recorded audit rows and that the payment provider was never invoked.
        private static (TicketService svc, FakeTicketRepository repo, FakeAuditLogRepository audit, UnusedPaymentProvider pay)
            Service(FakeTicketRepository tickets, FakeUserRepository? users = null)
        {
            var audit = new FakeAuditLogRepository();
            var uow = new AuthzUnitOfWork(
                tickets: tickets,
                users: users ?? new FakeUserRepository(),
                audit: audit);
            var pay = new UnusedPaymentProvider();
            var svc = new TicketService(uow, new NoopEmailService(), pay,
                new AuditLogService(uow), NullLogger<TicketService>.Instance);
            return (svc, tickets, audit, pay);
        }

        // ---- transferTicket --------------------------------------------------------

        [Fact]
        public async Task TransferTicket_success_writes_one_audit_row()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var users = new FakeUserRepository(new ApplicationUser { Id = AttackerId, Email = "b@test.local", FullName = "B" });
            var (svc, _, audit, _) = Service(repo, users);

            var dto = new TransferTicketDto
            {
                TicketId = ticket.Id,
                ToUserId = AttackerId,
                ToEmail = "b@test.local",
                ActingUserId = OwnerId,
                IsManager = false
            };

            await svc.TransferTicketAsync(dto);

            var row = Assert.Single(audit.Rows);
            Assert.Equal("TicketTransfer", row.Action);
            Assert.Equal("Ticket", row.EntityName);
            Assert.Equal(ticket.Id.ToString(), row.EntityId);
            Assert.Equal(OwnerId, row.UserId);
            Assert.NotNull(row.Changes);
            Assert.Contains(AttackerId, row.Changes);  // toUserId
            Assert.Contains(OwnerId, row.Changes);      // fromUserId
        }

        [Fact]
        public async Task TransferTicket_audit_actor_is_caller_not_recipient()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var users = new FakeUserRepository(new ApplicationUser { Id = AttackerId, Email = "b@test.local", FullName = "B" });
            var (svc, _, audit, _) = Service(repo, users);

            var dto = new TransferTicketDto
            {
                TicketId = ticket.Id,
                ToUserId = AttackerId,
                ToEmail = "b@test.local",
                ActingUserId = OwnerId,   // the caller / current owner
                IsManager = false
            };

            await svc.TransferTicketAsync(dto);

            var row = Assert.Single(audit.Rows);
            Assert.Equal(OwnerId, row.UserId);        // actor == caller
            Assert.NotEqual(AttackerId, row.UserId);  // actor != recipient
        }

        [Fact]
        public async Task TransferTicket_denied_ownership_writes_no_success_row()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var users = new FakeUserRepository(new ApplicationUser { Id = AttackerId, Email = "b@test.local", FullName = "B" });
            var (svc, _, audit, _) = Service(repo, users);

            var dto = new TransferTicketDto
            {
                TicketId = ticket.Id,
                ToUserId = AttackerId,
                ToEmail = "b@test.local",
                ActingUserId = AttackerId,   // attacker, not the owner -> throws before mutation
                IsManager = false
            };

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => svc.TransferTicketAsync(dto));
            Assert.Empty(audit.Rows);   // no audit row on a denied op
        }

        // ---- refundTicket ----------------------------------------------------------

        [Fact]
        public async Task RefundTicket_success_writes_audit_with_amount_only()
        {
            var ticket = CancelledTicket(OwnerId, totalPrice: 250m);
            var repo = new FakeTicketRepository(ticket);
            var (svc, _, audit, _) = Service(repo);

            var dto = new RefundTicketDto
            {
                TicketId = ticket.Id,
                PaymentMethod = "card",
                ActingUserId = "admin-1"
            };

            await svc.RefundTicketAsync(dto);

            var row = Assert.Single(audit.Rows);
            Assert.Equal("TicketRefund", row.Action);
            Assert.Equal("Ticket", row.EntityName);
            Assert.Equal(ticket.Id.ToString(), row.EntityId);
            Assert.Equal("admin-1", row.UserId);
            Assert.NotNull(row.Changes);

            using var doc = JsonDocument.Parse(row.Changes!);
            Assert.Equal(25000, doc.RootElement.GetProperty("amountMinor").GetInt64()); // 250.00 -> øre
            Assert.Equal("NOK", doc.RootElement.GetProperty("currency").GetString());

            // PCI/GDPR: ids + amounts only — NO card data of any kind.
            var lower = row.Changes!.ToLowerInvariant();
            Assert.DoesNotContain("card", lower);
            Assert.DoesNotContain("pan", lower);
            Assert.DoesNotContain("cvv", lower);
            Assert.DoesNotContain("token", lower);
        }

        [Fact]
        public async Task RefundTicket_audit_does_not_touch_payment_transaction()
        {
            var ticket = CancelledTicket(OwnerId, totalPrice: 100m);
            var repo = new FakeTicketRepository(ticket);
            var (svc, _, audit, pay) = Service(repo);

            var dto = new RefundTicketDto
            {
                TicketId = ticket.Id,
                PaymentMethod = "card",
                ActingUserId = "admin-1"
            };

            await svc.RefundTicketAsync(dto);

            // OrderItemId=null path: the provider's RefundAsync must NEVER be called (it throws
            // NotSupportedException if it were), yet an audit row still exists.
            Assert.False(pay.RefundCalled, "payment provider RefundAsync must not be invoked on the local-marker path");
            Assert.Single(audit.Rows);
        }

        // ---- cancelTicket ----------------------------------------------------------

        [Fact]
        public async Task CancelTicket_by_manager_writes_audit_byManager_true()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var (svc, _, audit, _) = Service(repo);

            var dto = new CancelTicketDto
            {
                TicketId = ticket.Id,
                Reason = "Admin action",
                ActingUserId = AttackerId,   // not the owner...
                IsManager = true             // ...but a manager
            };

            await svc.CancelTicketAsync(dto);

            var row = Assert.Single(audit.Rows);
            Assert.Equal("TicketCancel", row.Action);
            Assert.Equal(AttackerId, row.UserId);
            using var doc = JsonDocument.Parse(row.Changes!);
            Assert.True(doc.RootElement.GetProperty("byManager").GetBoolean());
        }

        [Fact]
        public async Task CancelTicket_by_owner_writes_audit_byManager_false()
        {
            var ticket = ActiveTicket(OwnerId);
            var repo = new FakeTicketRepository(ticket);
            var (svc, _, audit, _) = Service(repo);

            var dto = new CancelTicketDto
            {
                TicketId = ticket.Id,
                Reason = "Change of plans",
                ActingUserId = OwnerId,
                IsManager = false
            };

            await svc.CancelTicketAsync(dto);

            var row = Assert.Single(audit.Rows);
            Assert.Equal("TicketCancel", row.Action);
            Assert.Equal(OwnerId, row.UserId);
            using var doc = JsonDocument.Parse(row.Changes!);
            Assert.False(doc.RootElement.GetProperty("byManager").GetBoolean());
        }
    }
}
