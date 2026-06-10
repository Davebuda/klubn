using System.Globalization;
using System.Text;
using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace DJDiP.Application.Services
{
    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IOptions<EmailSettings> settings, ILogger<EmailService> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        // ─────────────────────────────────────────────────────────────
        // Public methods
        // ─────────────────────────────────────────────────────────────

        public async Task SendTicketConfirmationAsync(
            string toEmail, string toName, string ticketNumber,
            string eventTitle, DateTime eventDate, string venueName,
            string venueCity, decimal totalPrice, string qrCode)
        {
            var subject = $"Your ticket for {eventTitle} – {ticketNumber}";
            var html = BuildTicketConfirmationHtml(
                toName, ticketNumber, eventTitle, eventDate,
                venueName, venueCity, totalPrice, qrCode);
            await SendAsync(toEmail, toName, subject, html);
        }

        public async Task SendOrderConfirmationAsync(OrderConfirmationEmail email)
        {
            var subject = $"Your KlubN tickets — {email.EventTitle}";
            var html = BuildOrderConfirmationHtml(email);
            await SendAsync(email.ToEmail, email.ToName, subject, html);
        }

        public async Task SendTicketTransferConfirmationAsync(
            string toEmail, string toName, string ticketNumber,
            string eventTitle, DateTime eventDate, string venueName, string qrCode)
        {
            var subject = $"Ticket transferred to you – {eventTitle}";
            var html = BuildTransferConfirmationHtml(
                toName, ticketNumber, eventTitle, eventDate, venueName, qrCode);
            await SendAsync(toEmail, toName, subject, html);
        }

        public async Task SendRefundConfirmationAsync(
            string toEmail, string toName, string ticketNumber,
            string eventTitle, decimal refundAmount, string transactionId)
        {
            var subject = $"Refund processed – {eventTitle}";
            var html = BuildRefundConfirmationHtml(
                toName, ticketNumber, eventTitle, refundAmount, transactionId);
            await SendAsync(toEmail, toName, subject, html);
        }

        // ─────────────────────────────────────────────────────────────
        // Registration, Newsletter, Contact, Password Reset
        // ─────────────────────────────────────────────────────────────

        public async Task SendWelcomeEmailAsync(string toEmail, string toName)
        {
            var subject = "Welcome to KlubN!";
            var html = BuildWelcomeHtml(toName);
            await SendAsync(toEmail, toName, subject, html);
        }

        public async Task SendNewsletterWelcomeAsync(string toEmail)
        {
            var subject = "You're In – KlubN Newsletter";
            var html = BuildNewsletterWelcomeHtml();
            await SendAsync(toEmail, "", subject, html);
        }

        public async Task SendContactConfirmationAsync(string toEmail, string toName)
        {
            var subject = "We Got Your Message – KlubN";
            var html = BuildContactConfirmationHtml(toName);
            await SendAsync(toEmail, toName, subject, html);
        }

        public async Task SendContactAdminNotificationAsync(
            string adminEmail, string senderName, string senderEmail, string message)
        {
            var subject = $"New Contact Message from {senderName}";
            var html = BuildContactAdminHtml(senderName, senderEmail, message);
            await SendAsync(adminEmail, "Admin", subject, html);
        }

        public async Task SendPasswordResetAsync(string toEmail, string toName, string resetLink)
        {
            var subject = "Reset Your Password – KlubN";
            var html = BuildPasswordResetHtml(toName, resetLink);
            await SendAsync(toEmail, toName, subject, html);
        }

        // ─────────────────────────────────────────────────────────────
        // DJ Application emails
        // ─────────────────────────────────────────────────────────────

        public async Task SendDJApplicationSubmittedAsync(
            string toEmail, string toName, string stageName)
        {
            var subject = $"DJ Application Received – {stageName}";
            var html = BuildDJApplicationSubmittedHtml(toName, stageName);
            await SendAsync(toEmail, toName, subject, html);
        }

        public async Task SendAdminDJApplicationNotificationAsync(
            string adminEmail, string applicantName, string stageName)
        {
            var subject = $"New DJ Application: {stageName}";
            var html = BuildAdminDJNotificationHtml(applicantName, stageName);
            await SendAsync(adminEmail, "Admin", subject, html);
        }

        public async Task SendDJApplicationApprovedAsync(
            string toEmail, string toName, string stageName)
        {
            var subject = $"Welcome to the Lineup, {stageName}!";
            var html = BuildDJApplicationApprovedHtml(toName, stageName);
            await SendAsync(toEmail, toName, subject, html);
        }

        public async Task SendDJApplicationRejectedAsync(
            string toEmail, string toName, string stageName, string? reason)
        {
            var subject = $"DJ Application Update – {stageName}";
            var html = BuildDJApplicationRejectedHtml(toName, stageName, reason);
            await SendAsync(toEmail, toName, subject, html);
        }

        // ─────────────────────────────────────────────────────────────
        // Core send logic
        // ─────────────────────────────────────────────────────────────

        private async Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
        {
            if (!_settings.Enabled)
            {
                _logger.LogInformation(
                    "[EmailService] Email disabled. Would have sent '{Subject}' to {Email}",
                    subject, toEmail);
                return;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromAddress));
                message.ReplyTo.Add(new MailboxAddress(_settings.FromName, _settings.FromAddress));
                message.To.Add(new MailboxAddress(toName, toEmail));
                message.Subject = subject;

                // Include plain-text alternative to improve deliverability / avoid spam filters
                var builder = new BodyBuilder
                {
                    HtmlBody = htmlBody,
                    TextBody = StripHtml(htmlBody)
                };
                message.Body = builder.ToMessageBody();

                using var client = new SmtpClient();
                var secureOption = _settings.UseSsl
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTls;

                await client.ConnectAsync(_settings.SmtpHost, _settings.SmtpPort, secureOption);
                await client.AuthenticateAsync(_settings.Username, _settings.Password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("[EmailService] Sent '{Subject}' to {Email}", subject, toEmail);
            }
            catch (Exception ex)
            {
                // Log but never throw — email failure must never block the purchase flow
                _logger.LogError(ex, "[EmailService] Failed to send '{Subject}' to {Email}", subject, toEmail);
            }
        }

        private static string StripHtml(string html)
        {
            // Quick conversion: remove tags and decode common entities
            var text = System.Text.RegularExpressions.Regex.Replace(html, "<style[^>]*>.*?</style>", "", System.Text.RegularExpressions.RegexOptions.Singleline);
            text = System.Text.RegularExpressions.Regex.Replace(text, "<[^>]+>", " ");
            text = System.Net.WebUtility.HtmlDecode(text);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\s{2,}", " ").Trim();
            return text;
        }

        // ─────────────────────────────────────────────────────────────
        // Shared layout wrapper — CSS uses literal braces so we avoid
        // raw string interpolation conflicts by using string.Format or
        // standard concatenation for the style block.
        // ─────────────────────────────────────────────────────────────

        private static readonly string LayoutCss =
            "body{margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e5e5}" +
            ".wrapper{max-width:600px;margin:0 auto;padding:32px 16px}" +
            ".hdr{background:linear-gradient(135deg,#FF6B35,#5D1725);border-radius:16px 16px 0 0;padding:32px 32px 24px;text-align:center}" +
            ".hdr h1{margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px}" +
            ".hdr p{margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.75);letter-spacing:.1em;text-transform:uppercase}" +
            ".body{background:#111;border:1px solid #222;border-top:none;border-radius:0 0 16px 16px;padding:32px}" +
            ".tbox{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin:24px 0}" +
            ".lbl{font-size:10px;text-transform:uppercase;letter-spacing:.4em;color:#666;margin-bottom:4px}" +
            ".val{font-size:16px;font-weight:600;color:#fff;margin-bottom:16px}" +
            ".val.big{font-size:24px;color:#FF6B35;font-family:monospace;letter-spacing:.1em}" +
            ".divider{border:none;border-top:1px solid #222;margin:24px 0}" +
            ".badge{display:inline-block;background:linear-gradient(135deg,#FF6B35,#5D1725);color:#fff;" +
            "font-size:11px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;" +
            "padding:6px 16px;border-radius:999px;margin-bottom:20px}" +
            ".footer{text-align:center;margin-top:32px;font-size:11px;color:#444}" +
            ".footer a{color:#FF6B35;text-decoration:none}";

        private static string WrapInLayout(string title, string bodyContent)
        {
            return "<!DOCTYPE html><html lang=\"en\"><head>" +
                   "<meta charset=\"UTF-8\"/>" +
                   "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"/>" +
                   $"<title>{System.Net.WebUtility.HtmlEncode(title)}</title>" +
                   $"<style>{LayoutCss}</style></head><body>" +
                   "<div class=\"wrapper\">" +
                   "<div class=\"hdr\"><h1>KlubN</h1><p>Your night. Your music.</p></div>" +
                   $"<div class=\"body\">{bodyContent}</div>" +
                   "<div class=\"footer\">" +
                   "<p>&copy; KlubN &middot; <a href=\"https://klubn.com\">klubn.com</a></p>" +
                   "<p>Questions? <a href=\"mailto:support@klubn.com\">support@klubn.com</a></p>" +
                   "</div></div></body></html>";
        }

        // ─────────────────────────────────────────────────────────────
        // Template builders
        // ─────────────────────────────────────────────────────────────

        private static string BuildTicketConfirmationHtml(
            string toName, string ticketNumber, string eventTitle,
            DateTime eventDate, string venueName, string venueCity,
            decimal totalPrice, string qrCode)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;
            var formattedDate = eventDate.ToString("dddd, d MMMM yyyy \u00b7 HH:mm");
            var cityPart = string.IsNullOrWhiteSpace(venueCity) ? "" : $", {E(venueCity)}";
            var qrPreview = qrCode.Length > 8 ? qrCode[..8] + "…" : qrCode;

            var body =
                "<span class=\"badge\">Booking Confirmed</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)}! &#127881;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">You're all set for the night. Here's everything you need:</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Ticket Number</div><div class=\"val big\">" + E(ticketNumber) + "</div>" +
                "<div class=\"lbl\">Event</div><div class=\"val\">" + E(eventTitle) + "</div>" +
                "<div class=\"lbl\">Date &amp; Time</div><div class=\"val\">" + E(formattedDate) + "</div>" +
                "<div class=\"lbl\">Venue</div><div class=\"val\">" + E(venueName) + cityPart + "</div>" +
                "<hr class=\"divider\"/>" +
                "<div class=\"lbl\">Total Paid (incl. 12% VAT)</div>" +
                $"<div class=\"val\" style=\"color:#FF6B35\">&euro;{totalPrice:F2}</div>" +
                "</div>" +
                $"<p style=\"color:#888;font-size:13px;line-height:1.6\">Your QR code " +
                $"<strong style=\"color:#ccc;font-family:monospace\">{E(qrPreview)}</strong> " +
                "will be scanned at the door. Present this email or find your ticket in the KlubN app.</p>" +
                "<p style=\"color:#555;font-size:12px;margin-top:24px\">Doors open 30 minutes before the event. Valid photo ID required.</p>";

            return WrapInLayout($"Your ticket for {eventTitle}", body);
        }

        private static string BuildOrderConfirmationHtml(OrderConfirmationEmail email)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;
            var formattedDate = email.EventDate.ToString("dddd, d MMMM yyyy · HH:mm");
            var cityPart = string.IsNullOrWhiteSpace(email.VenueCity) ? "" : $", {E(email.VenueCity)}";

            // Money is minor units (øre). Format as "{major}.{2dp} {CUR}" (invariant), e.g.
            // "450.00 NOK" — never the legacy euro glyph (prices are NOK).
            string Money(long minor) =>
                (minor / 100m).ToString("0.00", CultureInfo.InvariantCulture) + " " + E(email.Currency);

            var rows = new StringBuilder();
            foreach (var line in email.Lines)
            {
                rows.Append("<div style=\"display:flex;justify-content:space-between;align-items:baseline;margin:0 0 10px\">")
                    .Append($"<span style=\"color:#ddd;font-size:14px\">{E(line.Name)} &times; {line.Quantity}</span>")
                    .Append($"<span style=\"color:#fff;font-size:14px;font-family:monospace\">{Money(line.LineTotalMinor)}</span>")
                    .Append("</div>");
            }

            var discountBlock = email.DiscountMinor > 0
                ? "<div style=\"display:flex;justify-content:space-between;align-items:baseline;margin:0 0 10px\">" +
                  $"<span style=\"color:#22c55e;font-size:14px\">Discount{(string.IsNullOrWhiteSpace(email.PromoCode) ? "" : $" ({E(email.PromoCode!)})")}</span>" +
                  $"<span style=\"color:#22c55e;font-size:14px;font-family:monospace\">-{Money(email.DiscountMinor)}</span>" +
                  "</div>"
                : "";

            var body =
                "<span class=\"badge\">Order Confirmed</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(email.ToName)}! &#127881;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">Your tickets are confirmed. Here's your order:</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Order Reference</div><div class=\"val big\">" + E(email.Reference) + "</div>" +
                "<div class=\"lbl\">Event</div><div class=\"val\">" + E(email.EventTitle) + "</div>" +
                "<div class=\"lbl\">Date &amp; Time</div><div class=\"val\">" + E(formattedDate) + "</div>" +
                "<div class=\"lbl\">Venue</div><div class=\"val\">" + E(email.VenueName) + cityPart + "</div>" +
                "<hr class=\"divider\"/>" +
                rows +
                discountBlock +
                "<hr class=\"divider\"/>" +
                "<div style=\"display:flex;justify-content:space-between;align-items:baseline\">" +
                "<span style=\"color:#FF6B35;font-size:13px;text-transform:uppercase;letter-spacing:.2em\">Total Paid</span>" +
                $"<span style=\"color:#FF6B35;font-size:20px;font-weight:700;font-family:monospace\">{Money(email.TotalMinor)}</span>" +
                "</div>" +
                "<p style=\"color:#666;font-size:11px;margin:8px 0 0\">Prices include Norwegian VAT.</p>" +
                "</div>" +
                "<div style=\"text-align:center;margin:32px 0\">" +
                $"<a href=\"{E(email.TicketsUrl)}\" style=\"display:inline-block;background:linear-gradient(135deg,#FF6B35,#5D1725);" +
                "color:#fff;font-size:14px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;" +
                "padding:14px 40px;border-radius:999px;text-decoration:none\">View My Tickets</a>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">Your QR codes are in your KlubN wallet and will be scanned at the door. " +
                "Doors open 30 minutes before the event. Valid photo ID required.</p>";

            return WrapInLayout($"Your KlubN tickets — {email.EventTitle}", body);
        }

        private static string BuildTransferConfirmationHtml(
            string toName, string ticketNumber, string eventTitle,
            DateTime eventDate, string venueName, string qrCode)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;
            var formattedDate = eventDate.ToString("dddd, d MMMM yyyy \u00b7 HH:mm");

            var body =
                "<span class=\"badge\">Ticket Transferred</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)}! &#127903;&#65039;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">Someone sent you a ticket. You're going out!</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Your New Ticket Number</div><div class=\"val big\">" + E(ticketNumber) + "</div>" +
                "<div class=\"lbl\">Event</div><div class=\"val\">" + E(eventTitle) + "</div>" +
                "<div class=\"lbl\">Date &amp; Time</div><div class=\"val\">" + E(formattedDate) + "</div>" +
                "<div class=\"lbl\">Venue</div><div class=\"val\">" + E(venueName) + "</div>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "A fresh QR code has been generated for you. The previous owner's QR code is now invalid.</p>";

            return WrapInLayout($"Ticket transferred – {eventTitle}", body);
        }

        private static string BuildRefundConfirmationHtml(
            string toName, string ticketNumber, string eventTitle,
            decimal refundAmount, string transactionId)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Refund Processed</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)},</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">Your refund has been processed. Please allow 3–5 business days for funds to appear.</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Original Ticket</div><div class=\"val\">" + E(ticketNumber) + "</div>" +
                "<div class=\"lbl\">Event</div><div class=\"val\">" + E(eventTitle) + "</div>" +
                "<hr class=\"divider\"/>" +
                $"<div class=\"lbl\">Refund Amount</div><div class=\"val\" style=\"color:#FF6B35\">&euro;{refundAmount:F2}</div>" +
                "<div class=\"lbl\">Transaction Reference</div>" +
                "<div class=\"val\" style=\"font-family:monospace;font-size:13px;color:#999\">" + E(transactionId) + "</div>" +
                "</div>" +
                "<p style=\"color:#555;font-size:12px\">Questions? " +
                "<a href=\"mailto:support@klubn.com\" style=\"color:#FF6B35\">support@klubn.com</a></p>";

            return WrapInLayout($"Refund for {eventTitle}", body);
        }

        private static string BuildDJApplicationSubmittedHtml(string toName, string stageName)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Application Received</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)}! &#127911;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">Your DJ application has been submitted successfully. Our team will review it and get back to you.</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Stage Name</div><div class=\"val big\">" + E(stageName) + "</div>" +
                "<div class=\"lbl\">Status</div><div class=\"val\" style=\"color:#eab308\">Pending Review</div>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "We typically review applications within a few business days. You'll receive an email once a decision is made.</p>";

            return WrapInLayout("DJ Application Received", body);
        }

        private static string BuildAdminDJNotificationHtml(string applicantName, string stageName)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">New Application</span>" +
                "<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">New DJ Application &#127926;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">A new DJ application has been submitted and requires review.</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Applicant</div><div class=\"val\">" + E(applicantName) + "</div>" +
                "<div class=\"lbl\">Stage Name</div><div class=\"val big\">" + E(stageName) + "</div>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "Log in to the admin panel to review and approve or reject this application.</p>";

            return WrapInLayout("New DJ Application", body);
        }

        private static string BuildDJApplicationApprovedHtml(string toName, string stageName)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Approved</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Congratulations, {E(toName)}! &#127881;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">Your DJ application has been approved. Welcome to the lineup!</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Stage Name</div><div class=\"val big\">" + E(stageName) + "</div>" +
                "<div class=\"lbl\">Status</div><div class=\"val\" style=\"color:#22c55e\">Approved</div>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "Your DJ profile has been created. Log in and head to your DJ Dashboard to customize your profile, " +
                "add your top 10 tracks, and start connecting with venues.</p>";

            return WrapInLayout($"Welcome to the Lineup, {stageName}!", body);
        }

        private static string BuildDJApplicationRejectedHtml(string toName, string stageName, string? reason)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var reasonBlock = string.IsNullOrWhiteSpace(reason)
                ? ""
                : "<hr class=\"divider\"/>" +
                  "<div class=\"lbl\">Feedback</div>" +
                  $"<div class=\"val\" style=\"color:#f87171;font-size:14px\">{E(reason)}</div>";

            var body =
                "<span class=\"badge\">Application Update</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)},</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">We've reviewed your DJ application and unfortunately it wasn't approved at this time.</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Stage Name</div><div class=\"val\">" + E(stageName) + "</div>" +
                "<div class=\"lbl\">Status</div><div class=\"val\" style=\"color:#f87171\">Not Approved</div>" +
                reasonBlock +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "If you have questions or would like to discuss this further, feel free to reach out to us.</p>";

            return WrapInLayout($"DJ Application Update – {stageName}", body);
        }

        // ─────────────────────────────────────────────────────────────
        // Welcome, Newsletter, Contact, Password Reset templates
        // ─────────────────────────────────────────────────────────────

        private static string BuildWelcomeHtml(string toName)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Welcome</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)}! &#127881;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">Welcome to KlubN — your gateway to the best DJ events, exclusive sets, and the underground music scene.</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Your Account Is Ready</div>" +
                "<div class=\"val\">Here's what you can do now:</div>" +
                "<ul style=\"color:#aaa;font-size:14px;line-height:2;margin:12px 0 0;padding-left:20px\">" +
                "<li>Browse and book tickets to upcoming events</li>" +
                "<li>Discover and follow your favorite DJs</li>" +
                "<li>Upload media and share event moments</li>" +
                "<li>Join the leaderboard and earn points</li>" +
                "</ul>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "Are you a DJ? You can apply to join the lineup directly from your dashboard.</p>";

            return WrapInLayout("Welcome to KlubN!", body);
        }

        private static string BuildNewsletterWelcomeHtml()
        {
            var body =
                "<span class=\"badge\">Subscribed</span>" +
                "<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">You're in! &#127911;</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">You've been added to the KlubN newsletter. Expect weekly drops, event announcements, presale codes, and exclusive content.</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">What to Expect</div>" +
                "<div class=\"val\">One email per week. No spam. Pure music.</div>" +
                "</div>" +
                "<p style=\"color:#555;font-size:12px;margin-top:24px\">You can unsubscribe at any time.</p>";

            return WrapInLayout("Welcome to the KlubN Newsletter", body);
        }

        private static string BuildContactConfirmationHtml(string toName)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Message Received</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Thanks, {E(toName)}!</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">We've received your message and will get back to you as soon as possible — usually within 24 hours.</p>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "If your inquiry is urgent, feel free to reach us directly at " +
                "<a href=\"mailto:letsgoklubn@gmail.com\" style=\"color:#FF6B35\">letsgoklubn@gmail.com</a>.</p>";

            return WrapInLayout("We Got Your Message", body);
        }

        private static string BuildContactAdminHtml(string senderName, string senderEmail, string message)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Contact Form</span>" +
                "<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">New Contact Message &#128233;</p>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">From</div><div class=\"val\">" + E(senderName) + "</div>" +
                "<div class=\"lbl\">Email</div><div class=\"val\">" +
                "<a href=\"mailto:" + E(senderEmail) + "\" style=\"color:#FF6B35\">" + E(senderEmail) + "</a></div>" +
                "<hr class=\"divider\"/>" +
                "<div class=\"lbl\">Message</div>" +
                "<div style=\"color:#ccc;font-size:14px;line-height:1.8;white-space:pre-wrap\">" + E(message) + "</div>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px\">Reply directly to this email or to the sender's address above.</p>";

            return WrapInLayout("New Contact Message", body);
        }

        private static string BuildPasswordResetHtml(string toName, string resetLink)
        {
            Func<string, string> E = System.Net.WebUtility.HtmlEncode;

            var body =
                "<span class=\"badge\">Password Reset</span>" +
                $"<p style=\"font-size:18px;font-weight:700;color:#fff;margin:0 0 8px\">Hey {E(toName)},</p>" +
                "<p style=\"color:#aaa;margin:0 0 24px\">We received a request to reset your password. Click the button below to create a new one.</p>" +
                "<div style=\"text-align:center;margin:32px 0\">" +
                $"<a href=\"{E(resetLink)}\" style=\"display:inline-block;background:linear-gradient(135deg,#FF6B35,#5D1725);" +
                "color:#fff;font-size:14px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;" +
                "padding:14px 40px;border-radius:999px;text-decoration:none\">Reset Password</a>" +
                "</div>" +
                "<div class=\"tbox\">" +
                "<div class=\"lbl\">Link Expires In</div><div class=\"val\">1 hour</div>" +
                "</div>" +
                "<p style=\"color:#888;font-size:13px;line-height:1.6\">" +
                "If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>" +
                "<p style=\"color:#555;font-size:11px;margin-top:24px;word-break:break-all\">Direct link: " +
                $"<a href=\"{E(resetLink)}\" style=\"color:#FF6B35\">{E(resetLink)}</a></p>";

            return WrapInLayout("Reset Your Password", body);
        }
    }
}
