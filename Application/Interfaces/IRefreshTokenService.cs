namespace DJDiP.Application.Interfaces
{
    // P0-WS3B. The refresh token is a SIGNED JWT (no DB table/migration): same signing key as the
    // access token, a longer expiry, and a distinct `typ=refresh` claim carrying the userId. It is
    // delivered ONLY in the HttpOnly `klubn_rt` cookie and validated on /api/auth/refresh by
    // signature + expiry + typ. A separate random CSRF token rides the non-HttpOnly `klubn_csrf`
    // cookie for double-submit defense.
    public interface IRefreshTokenService
    {
        // Mint a refresh JWT (typ=refresh, userId claim) valid for RefreshTokenDays.
        string IssueRefreshToken(string userId);

        // Validate a refresh JWT: signature + expiry + typ=refresh. Returns the userId on success,
        // null on any failure (expired, tampered, wrong typ, missing).
        string? ValidateRefreshToken(string? token);

        // Generate a cryptographically-random CSRF token (URL-safe) for the double-submit cookie.
        string GenerateCsrfToken();

        // How long the refresh cookie should live (days), for setting cookie MaxAge consistently.
        int RefreshTokenDays { get; }
    }
}
