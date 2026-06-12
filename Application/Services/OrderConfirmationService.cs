using DJDiP.Application.Common;
using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Options;
using DJDiP.Domain.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DJDiP.Application.Services
{
    // Post-fulfillment confirmation email (checkout-orchestration design §4.4). Loads the
    // finalized order (items + ticket-type names + event + venue + user) and the issued
    // tickets, composes ONE itemized OrderConfirmationEmail, and sends it via the existing
    // MailKit IEmailService — then stamps Ticket.ConfirmationEmailSentTo/Date on success.
    //
    // Depends only on abstractions (IUnitOfWork / IEmailService) so it lives in Application
    // alongside EmailService. The WHOLE method is exception-safe: every failure is caught and
    // logged here, never thrown — the orchestrator's finalize (and the webhook 200) must not
    // depend on email.
    public sealed class OrderConfirmationService : IOrderConfirmationService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEmailService _email;
        private readonly AppSettings _appSettings;
        private readonly ILogger<OrderConfirmationService> _log;

        public OrderConfirmationService(
            IUnitOfWork unitOfWork,
            IEmailService email,
            IOptions<AppSettings> appSettings,
            ILogger<OrderConfirmationService> log)
        {
            _unitOfWork = unitOfWork;
            _email = email;
            _appSettings = appSettings.Value;
            _log = log;
        }

        public async Task SendAsync(Guid orderId, CancellationToken ct)
        {
            try
            {
                var order = await _unitOfWork.Orders.GetOrderForConfirmationAsync(orderId, ct);
                if (order is null)
                {
                    _log.LogWarning("OrderConfirmation: order {OrderId} not found; skipping email.", orderId);
                    return;
                }

                // Delivery target: explicit CustomerEmail (guest/override) first, else the
                // signed-in user's email. Skip (WARN) when neither is present.
                var toEmail = !string.IsNullOrWhiteSpace(order.CustomerEmail)
                    ? order.CustomerEmail!
                    : order.User?.Email;
                if (string.IsNullOrWhiteSpace(toEmail))
                {
                    _log.LogWarning("OrderConfirmation: no delivery email for order {Reference}; skipping.", order.Reference);
                    return;
                }

                var toName = order.User?.FullName ?? "there";

                // Event/venue from the first item (an order is single-event in practice;
                // checkout collapses lines per event). Defensive nulls if the graph is thin.
                var firstEvent = order.OrderItems
                    .Select(i => i.Event)
                    .FirstOrDefault(e => e is not null);
                var eventTitle = firstEvent?.Title ?? "your event";
                var eventDate = firstEvent?.Date ?? DateTime.UtcNow;
                var venueName = firstEvent?.Venue?.Name ?? string.Empty;
                var venueCity = firstEvent?.Venue?.City ?? string.Empty;

                var lines = order.OrderItems
                    .Select(i => new OrderConfirmationLine(
                        Name: i.TicketType?.Name ?? "Ticket",
                        Quantity: i.Quantity,
                        LineTotalMinor: i.LineTotalMinor - i.DiscountMinor))   // discounted line total
                    .ToList();

                var totalMinor = (long)Math.Round(order.TotalAmount * 100m, MidpointRounding.AwayFromZero);

                var frontend = (_appSettings.FrontendUrl ?? string.Empty).TrimEnd('/');
                var ticketsUrl = $"{frontend}/tickets";

                var payload = new OrderConfirmationEmail(
                    ToEmail: toEmail,
                    ToName: toName,
                    Reference: order.Reference,
                    EventTitle: eventTitle,
                    EventDate: eventDate,
                    VenueName: venueName,
                    VenueCity: venueCity,
                    Lines: lines,
                    PromoCode: order.PromoCode,
                    DiscountMinor: order.DiscountMinor,
                    TotalMinor: totalMinor,
                    Currency: "NOK",
                    TicketsUrl: ticketsUrl);

                await _email.SendOrderConfirmationAsync(payload);

                // Stamp the issued tickets on success (design §4.4). IEmailService swallows
                // SMTP errors internally and never throws, so reaching here means "attempted
                // to send" — the stamp records the delivery target + time for audit/idempotency.
                var tickets = (await _unitOfWork.Tickets.GetTicketsByOrderAsync(orderId, ct)).ToList();
                if (tickets.Count > 0)
                {
                    var stampedAt = DateTime.UtcNow;
                    foreach (var t in tickets)
                    {
                        t.ConfirmationEmailSentTo = toEmail;
                        t.ConfirmationEmailSentDate = stampedAt;
                    }
                    await _unitOfWork.Tickets.SaveChangesAsync();
                }

                _log.LogInformation("OrderConfirmation: confirmation email queued for order {Reference} to {Email}.", order.Reference, PiiMasker.MaskEmail(toEmail));
            }
            catch (Exception ex)
            {
                // Best-effort: a confirmation failure is recoverable (tickets are in the
                // wallet). NEVER propagate — the finalize/webhook must not fail on email.
                _log.LogError(ex, "OrderConfirmation: failed to send confirmation for order {OrderId} (non-fatal).", orderId);
            }
        }
    }
}
