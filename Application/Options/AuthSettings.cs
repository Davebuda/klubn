namespace DJDiP.Application.Options
{
    public class AuthSettings
    {
        public string Key { get; set; } = string.Empty;
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public int AccessTokenMinutes { get; set; } = 60;
        // P0-WS3B — refresh token (signed JWT in the HttpOnly klubn_rt cookie) lifetime.
        public int RefreshTokenDays { get; set; } = 7;
    }
}
