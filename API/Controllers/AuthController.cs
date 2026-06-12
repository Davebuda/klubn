using DJDiP.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DJDiP.API.Controllers;

// P0-WS3B — cookie-based session refresh + logout. The credential is the HttpOnly klubn_rt cookie
// (a signed refresh JWT), so these are [AllowAnonymous]: there is no Authorization header on a
// refresh. CSRF defense is double-submit: the caller must echo the non-HttpOnly klubn_csrf cookie
// in the X-CSRF-Token header. Because klubn_rt is SameSite=Strict + Path=/api/auth and the CSRF
// cookie is unreadable cross-origin, a cross-site forgery cannot supply a matching header.
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IRefreshTokenService _refreshTokens;
    private readonly IWebHostEnvironment _env;

    public AuthController(
        IAuthService authService, IRefreshTokenService refreshTokens, IWebHostEnvironment env)
    {
        _authService = authService;
        _refreshTokens = refreshTokens;
        _env = env;
    }

    public record RefreshResponse(string AccessToken, AuthUser User);
    public record AuthUser(string Id, string Email, string FullName, string Role, string? ProfilePictureUrl);

    // POST /api/auth/refresh — restore a session from the klubn_rt cookie. Requires the
    // double-submit CSRF match (else 403) and a valid refresh JWT (else 401). On success: mint a
    // fresh access token, ROTATE both cookies (new refresh JWT + new CSRF), and return the access
    // token + user in the body. The refresh token is NEVER returned in the body.
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        // 1. Double-submit CSRF: header must equal the cookie, both present & non-empty.
        var csrfHeader = Request.Headers["X-CSRF-Token"].ToString();
        var csrfCookie = Request.Cookies[AuthCookies.CsrfCookie];
        if (string.IsNullOrEmpty(csrfHeader) ||
            string.IsNullOrEmpty(csrfCookie) ||
            !FixedTimeEquals(csrfHeader, csrfCookie))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF validation failed." });
        }

        // 2. Validate the refresh JWT from the cookie (signature + expiry + typ=refresh).
        var refreshCookie = Request.Cookies[AuthCookies.RefreshCookie];
        var userId = _refreshTokens.ValidateRefreshToken(refreshCookie);
        if (userId == null)
        {
            return Unauthorized(new { error = "Invalid or expired session." });
        }

        // 3. Re-issue an access token (re-reads the user; a deleted account cannot refresh).
        var payload = await _authService.IssueForUserIdAsync(userId);
        if (payload == null)
        {
            return Unauthorized(new { error = "Invalid or expired session." });
        }

        // 4. Rotate both cookies (refresh-token rotation limits the window of a leaked cookie).
        var newRefresh = _refreshTokens.IssueRefreshToken(userId);
        var newCsrf = _refreshTokens.GenerateCsrfToken();
        AuthCookies.SetAuthCookies(
            Response, newRefresh, newCsrf, _env.IsDevelopment(), _refreshTokens.RefreshTokenDays);

        return Ok(new RefreshResponse(
            payload.AccessToken,
            new AuthUser(
                payload.User.Id, payload.User.Email, payload.User.FullName,
                payload.User.Role, payload.User.ProfilePictureUrl)));
    }

    // POST /api/auth/logout — expire both cookies. 204 regardless (idempotent; no body).
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        AuthCookies.ClearAuthCookies(Response, _env.IsDevelopment());
        return NoContent();
    }

    // Constant-time string comparison so the CSRF check does not leak length/content via timing.
    private static bool FixedTimeEquals(string a, string b)
    {
        var ab = System.Text.Encoding.UTF8.GetBytes(a);
        var bb = System.Text.Encoding.UTF8.GetBytes(b);
        if (ab.Length != bb.Length) return false;
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(ab, bb);
    }
}
