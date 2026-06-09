namespace DJDiP.Application.Options
{
    public class EmailSettings
    {
        public string SmtpHost { get; set; } = "smtp.gmail.com";
        public int SmtpPort { get; set; } = 587;
        public bool UseSsl { get; set; } = false;      // STARTTLS on 587; true for port 465
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FromAddress { get; set; } = "noreply@klubn.com";
        public string FromName { get; set; } = "KlubN";
        public bool Enabled { get; set; } = false;     // Flip to true once SMTP creds are set
    }
}
