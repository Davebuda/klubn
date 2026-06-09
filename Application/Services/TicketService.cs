using DJDiP.Application.DTO.TicketDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using Microsoft.Extensions.Logging;

namespace DJDiP.Application.Services
{
    public class TicketService : ITicketService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEmailService _emailService;
        private readonly ILogger<TicketService> _logger;
        private const decimal NORWEGIAN_EVENT_VAT_RATE = 0.12m; // 12% VAT for event tickets in Norway

        public TicketService(
            IUnitOfWork unitOfWork,
            IEmailService emailService,
            ILogger<TicketService> logger)
        {
            _unitOfWork = unitOfWork;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<IEnumerable<TicketDto>> GetTicketsByUserIdAsync(string userId)
        {
            var tickets = await _unitOfWork.Tickets.GetTicketsByUserIdAsync(userId);
            return tickets.Select(t => MapToDto(t)).ToList();
        }

        public async Task<IEnumerable<TicketDto>> GetTicketsByEventIdAsync(Guid eventId)
        {
            var tickets = await _unitOfWork.Tickets.GetTicketsByEventIdAsync(eventId);
            return tickets.Select(t => MapToDto(t)).ToList();
        }

        public async Task<TicketDto?> GetTicketByIdAsync(Guid ticketId)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(ticketId);
            return ticket == null ? null : MapToDto(ticket);
        }

        public async Task<TicketDto> CreateTicketAsync(CreateTicketDto ticketDto)
        {
            // Validation
            if (!ticketDto.TermsAccepted)
            {
                throw new InvalidOperationException("Terms and conditions must be accepted to purchase a ticket");
            }

            var ev = await _unitOfWork.Events.GetByIdAsync(ticketDto.EventId)
                ?? throw new ArgumentException("Event not found");

            var user = await _unitOfWork.Users.GetByIdAsync(ticketDto.UserId)
                ?? throw new ArgumentException("User not found");

            // Calculate VAT according to Norwegian standards (12% for event tickets)
            var basePrice = ev.Price / (1 + NORWEGIAN_EVENT_VAT_RATE);
            var vatAmount = ev.Price - basePrice;

            var ticket = new Ticket
            {
                Id = Guid.NewGuid(),
                EventId = ev.Id,
                UserId = user.Id,
                BasePrice = Math.Round(basePrice, 2),
                VATRate = NORWEGIAN_EVENT_VAT_RATE,
                VATAmount = Math.Round(vatAmount, 2),
                TotalPrice = ev.Price,
                TicketNumber = GenerateTicketNumber(),
                QRCode = GenerateQRCode(),
                TermsAccepted = true,
                TermsAcceptedDate = DateTime.UtcNow,
                Status = TicketStatus.Active,
                ConfirmationEmailSentTo = ticketDto.Email,
                ConfirmationEmailSentDate = DateTime.UtcNow
            };

            await _unitOfWork.Tickets.AddAsync(ticket);
            await _unitOfWork.SaveChangesAsync();

            // Send purchase confirmation email (non-blocking — failure never aborts the transaction)
            var emailAddress = ticketDto.Email ?? user.Email;
            if (!string.IsNullOrWhiteSpace(emailAddress))
            {
                try
                {
                    await _emailService.SendTicketConfirmationAsync(
                        toEmail: emailAddress,
                        toName: user.FullName ?? user.Email,
                        ticketNumber: ticket.TicketNumber,
                        eventTitle: ev.Title,
                        eventDate: ev.Date,
                        venueName: ev.Venue?.Name ?? "TBA",
                        venueCity: ev.Venue?.City ?? string.Empty,
                        totalPrice: ticket.TotalPrice,
                        qrCode: ticket.QRCode);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Failed to send ticket confirmation email for ticket {TicketNumber}",
                        ticket.TicketNumber);
                }
            }

            return MapToDto(ticket, ev);
        }

        public async Task<bool> CheckInTicketAsync(Guid ticketId)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(ticketId);
            if (ticket == null)
            {
                return false;
            }

            if (!ticket.IsValid || ticket.IsUsed || ticket.Status != TicketStatus.Active)
            {
                return false;
            }

            ticket.IsUsed = true;
            ticket.CheckInTime = DateTime.UtcNow;
            ticket.Status = TicketStatus.Used;
            await _unitOfWork.Tickets.UpdateAsync(ticket);
            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<bool> InvalidateTicketAsync(Guid ticketId)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(ticketId);
            if (ticket == null)
            {
                return false;
            }

            ticket.IsValid = false;
            ticket.Status = TicketStatus.Expired;
            await _unitOfWork.Tickets.UpdateAsync(ticket);
            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<TicketDto?> CancelTicketAsync(CancelTicketDto cancelDto)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(cancelDto.TicketId);
            if (ticket == null || ticket.Status != TicketStatus.Active)
            {
                return null;
            }

            // Norwegian consumer rights: typically 14 days for distance sales
            ticket.Status = TicketStatus.Cancelled;
            ticket.CancelledDate = DateTime.UtcNow;
            ticket.CancellationReason = cancelDto.Reason;
            ticket.IsValid = false;

            await _unitOfWork.Tickets.UpdateAsync(ticket);
            await _unitOfWork.SaveChangesAsync();

            return MapToDto(ticket);
        }

        public async Task<TicketDto?> RefundTicketAsync(RefundTicketDto refundDto)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(refundDto.TicketId);
            if (ticket == null || ticket.Status != TicketStatus.Cancelled)
            {
                return null;
            }

            var transactionId = Guid.NewGuid().ToString("N");

            ticket.Status = TicketStatus.Refunded;
            ticket.RefundedDate = DateTime.UtcNow;
            ticket.RefundTransactionId = transactionId;

            await _unitOfWork.Tickets.UpdateAsync(ticket);
            await _unitOfWork.SaveChangesAsync();

            // Send refund confirmation email
            var emailAddress = ticket.ConfirmationEmailSentTo;
            var user = ticket.User;
            if (!string.IsNullOrWhiteSpace(emailAddress) && ticket.Event != null)
            {
                try
                {
                    await _emailService.SendRefundConfirmationAsync(
                        toEmail: emailAddress,
                        toName: user?.FullName ?? user?.Email ?? "Valued Customer",
                        ticketNumber: ticket.TicketNumber,
                        eventTitle: ticket.Event.Title,
                        refundAmount: ticket.TotalPrice,
                        transactionId: transactionId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Failed to send refund email for ticket {TicketNumber}",
                        ticket.TicketNumber);
                }
            }

            return MapToDto(ticket);
        }

        public async Task<TicketDto?> TransferTicketAsync(TransferTicketDto transferDto)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(transferDto.TicketId);
            if (ticket == null || ticket.Status != TicketStatus.Active || ticket.IsUsed)
            {
                return null;
            }

            var newUser = await _unitOfWork.Users.GetByIdAsync(transferDto.ToUserId);
            if (newUser == null)
            {
                throw new ArgumentException("Target user not found");
            }

            var eventTitle = ticket.Event?.Title ?? "your event";
            var eventDate = ticket.Event?.Date ?? DateTime.UtcNow;
            var venueName = ticket.Event?.Venue?.Name ?? "TBA";

            ticket.TransferredFromUserId = ticket.UserId;
            ticket.UserId = transferDto.ToUserId;
            ticket.TransferredDate = DateTime.UtcNow;
            ticket.Status = TicketStatus.Transferred;
            ticket.ConfirmationEmailSentTo = transferDto.ToEmail;
            ticket.ConfirmationEmailSentDate = DateTime.UtcNow;

            // New QR code for security — previous owner's QR is now invalid
            ticket.QRCode = GenerateQRCode();

            await _unitOfWork.Tickets.UpdateAsync(ticket);
            await _unitOfWork.SaveChangesAsync();

            // Send transfer confirmation to the new owner
            if (!string.IsNullOrWhiteSpace(transferDto.ToEmail))
            {
                try
                {
                    await _emailService.SendTicketTransferConfirmationAsync(
                        toEmail: transferDto.ToEmail,
                        toName: newUser.FullName ?? newUser.Email,
                        ticketNumber: ticket.TicketNumber,
                        eventTitle: eventTitle,
                        eventDate: eventDate,
                        venueName: venueName,
                        qrCode: ticket.QRCode);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Failed to send transfer email for ticket {TicketNumber}",
                        ticket.TicketNumber);
                }
            }

            return MapToDto(ticket);
        }

        public async Task DeleteAsync(Guid ticketId)
        {
            var ticket = await _unitOfWork.Tickets.GetByIdAsync(ticketId);
            if (ticket == null)
            {
                return;
            }

            await _unitOfWork.Tickets.DeleteAsync(ticket);
            await _unitOfWork.SaveChangesAsync();
        }

        private static string GenerateTicketNumber()
        {
            var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
            var randomPart = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
            return $"TKT-{datePart}-{randomPart}";
        }

        private static string GenerateQRCode()
        {
            return Guid.NewGuid().ToString("N").ToUpperInvariant();
        }

        private static TicketDto MapToDto(Ticket ticket, Event? ev = null)
        {
            ev ??= ticket.Event ?? throw new InvalidOperationException("Ticket is missing event navigation");

            return new TicketDto
            {
                Id = ticket.Id,
                EventId = ticket.EventId,
                UserId = ticket.UserId,
                TicketNumber = ticket.TicketNumber,
                QRCode = ticket.QRCode,
                BasePrice = ticket.BasePrice,
                VATRate = ticket.VATRate,
                VATAmount = ticket.VATAmount,
                TotalPrice = ticket.TotalPrice,
                PurchaseDate = ticket.PurchaseDate,
                IsValid = ticket.IsValid,
                IsCheckedIn = ticket.IsUsed,
                Status = ticket.Status.ToString(),
                CheckInTime = ticket.CheckInTime,
                CancelledDate = ticket.CancelledDate,
                RefundedDate = ticket.RefundedDate,
                TermsAccepted = ticket.TermsAccepted,
                TermsAcceptedDate = ticket.TermsAcceptedDate,
                TransferredFromUserId = ticket.TransferredFromUserId,
                TransferredDate = ticket.TransferredDate,
                Event = new TicketEventDto
                {
                    Id = ev.Id,
                    Title = ev.Title,
                    Date = ev.Date,
                    VenueName = ev.Venue?.Name ?? "TBA",
                    City = ev.Venue?.City ?? string.Empty,
                    ImageUrl = ev.ImageUrl ?? string.Empty
                }
            };
        }
    }
}
