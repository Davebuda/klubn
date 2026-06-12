using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DJDiP.Application.Services
{
    // P0-WS3B refresh-token implementation. A refresh token is a JWT signed with the SAME key as
    // the access token but with a distinct `typ=refresh` claim and a 7-day expiry. Validation
    // requires a valid signature, a non-expired token, AND typ=refresh — so an access token can
    // never be replayed as a refresh token (and vice-versa). No DB table is involved.
    public class RefreshTokenService : IRefreshTokenService
    {
        private readonly AuthSettings _settings;

        public RefreshTokenService(IOptions<AuthSettings> options)
        {
            _settings = options.Value;
        }

        public int RefreshTokenDays => _settings.RefreshTokenDays;

        public string IssueRefreshToken(string userId)
        {
            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new("userId", userId),
                new("typ", "refresh"),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
            };

            var token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(_settings.RefreshTokenDays),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string? ValidateRefreshToken(string? token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;

            var handler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _settings.Issuer,
                ValidateAudience = true,
                ValidAudience = _settings.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            };

            try
            {
                var principal = handler.ValidateToken(token, validationParameters, out _);

                // typ MUST be refresh — an access token presented here is rejected.
                var typ = principal.FindFirst("typ")?.Value;
                if (typ != "refresh") return null;

                var userId = principal.FindFirst("userId")?.Value;
                return string.IsNullOrEmpty(userId) ? null : userId;
            }
            catch (Exception)
            {
                // Any validation failure (expired, tampered signature, malformed) -> not valid.
                return null;
            }
        }

        public string GenerateCsrfToken()
        {
            // 32 random bytes, URL-safe base64 (no padding) so it is a clean cookie value.
            var bytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToBase64String(bytes)
                .Replace("+", "-").Replace("/", "_").TrimEnd('=');
        }
    }
}
