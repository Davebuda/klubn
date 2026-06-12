using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DJDiP.Application.DTO.Auth;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Options;
using DJDiP.Domain.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DJDiP.Application.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly AuthSettings _settings;
        private readonly ILoginThrottle _loginThrottle;

        public AuthService(IUnitOfWork unitOfWork, IOptions<AuthSettings> options, ILoginThrottle loginThrottle)
        {
            _unitOfWork = unitOfWork;
            _settings = options.Value;
            _loginThrottle = loginThrottle;
        }

        private static void ValidatePassword(string password)
        {
            if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
                throw new InvalidOperationException("Password must be at least 8 characters long.");
            if (!password.Any(char.IsUpper))
                throw new InvalidOperationException("Password must contain at least one uppercase letter.");
            if (!password.Any(char.IsLower))
                throw new InvalidOperationException("Password must contain at least one lowercase letter.");
            if (!password.Any(char.IsDigit))
                throw new InvalidOperationException("Password must contain at least one digit.");
            if (!password.Any(c => !char.IsLetterOrDigit(c)))
                throw new InvalidOperationException("Password must contain at least one special character.");
        }

        // P0-WS3C (GDPR) — the binding terms/privacy policy version accepted at signup.
        // Stamped on every user who registers; bump when the policy materially changes.
        public const string CurrentTermsVersion = "2026-06-11";

        public async Task<AuthPayload> RegisterAsync(
            string fullName, string email, string password,
            bool acceptTerms, bool marketingOptIn = false, string? marketingPurpose = null)
        {
            // P0-WS3C — terms acceptance is REQUIRED and enforced server-side (no bypass).
            // Reject BEFORE any password hashing / DB write so no user row is created.
            if (!acceptTerms)
                throw new InvalidOperationException("You must accept the terms and privacy policy to register.");

            ValidatePassword(password);

            var existingUser = await _unitOfWork.Users.GetByEmailAsync(email);
            if (existingUser != null)
            {
                throw new InvalidOperationException("An account with this email already exists.");
            }

            var now = DateTime.UtcNow;
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(),
                FullName = fullName,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Provider = "Local",
                Role = 0,
                CreatedAt = now,
                UpdatedAt = now,
                // Terms consent — stamped with timestamp + policy version (Art. 7 provability).
                TermsAcceptedAt = now,
                TermsVersion = CurrentTermsVersion
            };

            // Marketing is a SEPARATE, explicit opt-in — stamped only when the user opted in,
            // with its own timestamp + purpose. Never inferred from terms acceptance.
            if (marketingOptIn)
            {
                user.MarketingOptIn = true;
                user.MarketingOptInAt = now;
                user.MarketingPurpose = string.IsNullOrWhiteSpace(marketingPurpose)
                    ? "email-marketing"
                    : marketingPurpose;
            }

            await _unitOfWork.Users.AddAsync(user);
            await _unitOfWork.SaveChangesAsync();

            return GenerateAuthPayload(user);
        }

        public async Task<AuthPayload> LoginAsync(string email, string password)
        {
            // P0-WS3A — per-account lockout. The SAME generic "Invalid credentials." is returned for
            // locked, unknown, and wrong-password cases, so the lock never leaks account existence
            // (preserves the existing enumeration-safe behavior). Lock is keyed by email, never IP.
            if (_loginThrottle.IsLocked(email))
            {
                throw new InvalidOperationException("Invalid credentials.");
            }

            var user = await _unitOfWork.Users.GetByEmailAsync(email);
            if (user == null)
            {
                throw new InvalidOperationException("Invalid credentials.");
            }

            var passwordValid = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
            if (!passwordValid)
            {
                // Count this consecutive failure against the account; crossing the threshold locks it.
                _loginThrottle.RegisterFailure(email);
                throw new InvalidOperationException("Invalid credentials.");
            }

            // Success clears any accumulated failures for this account.
            _loginThrottle.Reset(email);
            return GenerateAuthPayload(user);
        }

        public async Task<AuthPayload?> IssueForUserIdAsync(string userId)
        {
            // P0-WS3B — the refresh endpoint has already proven the caller's identity via the signed
            // klubn_rt cookie. We re-read the user (so a deleted/disabled account cannot refresh) and
            // mint a fresh access token with current claims (role changes take effect on refresh).
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user == null) return null;
            return GenerateAuthPayload(user);
        }

        private AuthPayload GenerateAuthPayload(ApplicationUser user)
        {
            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new("userId", user.Id), // Add userId claim for GraphQL mutations
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Role, MapRole(user.Role))
            };

            var token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes),
                signingCredentials: credentials);

            var handler = new JwtSecurityTokenHandler();

            return new AuthPayload
            {
                AccessToken = handler.WriteToken(token),
                RefreshToken = Guid.NewGuid().ToString("N"),
                User = new AuthUserPayload
                {
                    Id = user.Id,
                    Email = user.Email,
                    FullName = user.FullName,
                    Role = MapRole(user.Role),
                    ProfilePictureUrl = user.ProfilePictureUrl
                }
            };
        }

        public async Task<(string Token, string Email, string FullName)?> GeneratePasswordResetTokenAsync(string email)
        {
            var user = await _unitOfWork.Users.GetByEmailAsync(email);
            if (user == null) return null;

            var token = Guid.NewGuid().ToString("N");
            user.PasswordResetToken = BCrypt.Net.BCrypt.HashPassword(token);
            user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            user.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();

            return (token, user.Email, user.FullName);
        }

        public async Task<bool> ResetPasswordAsync(string email, string token, string newPassword)
        {
            ValidatePassword(newPassword);

            var user = await _unitOfWork.Users.GetByEmailAsync(email);
            if (user == null)
                throw new InvalidOperationException("Invalid reset request.");

            if (string.IsNullOrEmpty(user.PasswordResetToken) ||
                user.PasswordResetTokenExpiry == null ||
                user.PasswordResetTokenExpiry < DateTime.UtcNow)
                throw new InvalidOperationException("Reset link has expired. Please request a new one.");

            if (!BCrypt.Net.BCrypt.Verify(token, user.PasswordResetToken))
                throw new InvalidOperationException("Invalid reset link. Please request a new one.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiry = null;
            user.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        private static string MapRole(int role) => role switch
        {
            2 => "Admin",
            1 => "DJ",
            3 => "EventOrganizer",
            4 => "CoAdmin",
            _ => "User"
        };
    }
}
