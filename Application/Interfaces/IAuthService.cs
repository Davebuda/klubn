using DJDiP.Application.DTO.Auth;

namespace DJDiP.Application.Interfaces
{
    public interface IAuthService
    {
        // P0-WS3C (GDPR): consent at signup. acceptTerms is REQUIRED — RegisterAsync rejects
        // when it is false (server-enforced, no bypass) and stamps TermsAcceptedAt + TermsVersion
        // on success. marketingOptIn is a SEPARATE, optional opt-in stamped independently
        // (MarketingOptInAt + purpose); terms and marketing are never bundled.
        Task<AuthPayload> RegisterAsync(
            string fullName, string email, string password,
            bool acceptTerms, bool marketingOptIn = false, string? marketingPurpose = null);
        Task<AuthPayload> LoginAsync(string email, string password);
        // P0-WS3B — re-issue an access token + user payload for an already-authenticated user
        // (the refresh endpoint calls this after validating the klubn_rt cookie). Returns null if
        // the user no longer exists. The returned AuthPayload.RefreshToken is the throwaway GUID and
        // is NOT used as a credential (the real refresh JWT comes from IRefreshTokenService).
        Task<AuthPayload?> IssueForUserIdAsync(string userId);
        Task<(string Token, string Email, string FullName)?> GeneratePasswordResetTokenAsync(string email);
        Task<bool> ResetPasswordAsync(string email, string token, string newPassword);
    }
}
