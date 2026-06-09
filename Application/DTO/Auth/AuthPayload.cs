namespace DJDiP.Application.DTO.Auth
{
    public class AuthPayload
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public AuthUserPayload User { get; set; } = new();
    }

    public class AuthUserPayload
    {
        public string Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = "User";
        public string? ProfilePictureUrl { get; set; }
    }
}
