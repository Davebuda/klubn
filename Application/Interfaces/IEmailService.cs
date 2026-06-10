using DJDiP.Application.DTO.PaymentDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IEmailService
    {
        /// <summary>Sends a ticket purchase confirmation email.</summary>
        Task SendTicketConfirmationAsync(
            string toEmail,
            string toName,
            string ticketNumber,
            string eventTitle,
            DateTime eventDate,
            string venueName,
            string venueCity,
            decimal totalPrice,
            string qrCode);

        /// <summary>
        /// Sends ONE itemized order confirmation for a finalized ticket order
        /// (checkout-orchestration design §4.4). Lines carry the discounted line totals;
        /// a discount line is shown when a promo was applied. Money is minor units (øre).
        /// </summary>
        Task SendOrderConfirmationAsync(OrderConfirmationEmail email);

        /// <summary>Sends a ticket transfer confirmation to the new owner.</summary>
        Task SendTicketTransferConfirmationAsync(
            string toEmail,
            string toName,
            string ticketNumber,
            string eventTitle,
            DateTime eventDate,
            string venueName,
            string qrCode);

        /// <summary>Sends a refund confirmation email.</summary>
        Task SendRefundConfirmationAsync(
            string toEmail,
            string toName,
            string ticketNumber,
            string eventTitle,
            decimal refundAmount,
            string transactionId);

        /// <summary>Sends confirmation to a user after submitting a DJ application.</summary>
        Task SendDJApplicationSubmittedAsync(
            string toEmail,
            string toName,
            string stageName);

        /// <summary>Notifies admin that a new DJ application was submitted.</summary>
        Task SendAdminDJApplicationNotificationAsync(
            string adminEmail,
            string applicantName,
            string stageName);

        /// <summary>Notifies user that their DJ application was approved.</summary>
        Task SendDJApplicationApprovedAsync(
            string toEmail,
            string toName,
            string stageName);

        /// <summary>Notifies user that their DJ application was rejected.</summary>
        Task SendDJApplicationRejectedAsync(
            string toEmail,
            string toName,
            string stageName,
            string? reason);

        /// <summary>Sends a welcome email after registration.</summary>
        Task SendWelcomeEmailAsync(
            string toEmail,
            string toName);

        /// <summary>Sends a newsletter subscription confirmation.</summary>
        Task SendNewsletterWelcomeAsync(
            string toEmail);

        /// <summary>Sends a contact form acknowledgment to the user.</summary>
        Task SendContactConfirmationAsync(
            string toEmail,
            string toName);

        /// <summary>Notifies admin of a new contact form message.</summary>
        Task SendContactAdminNotificationAsync(
            string adminEmail,
            string senderName,
            string senderEmail,
            string message);

        /// <summary>Sends a password reset link.</summary>
        Task SendPasswordResetAsync(
            string toEmail,
            string toName,
            string resetLink);
    }
}
