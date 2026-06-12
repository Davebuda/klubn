using Microsoft.AspNetCore.Http;

namespace DJDiP.API.Controllers;

// P0-WS3B — single source of truth for the auth cookies, shared by the login/register GraphQL
// resolvers (Program.cs) and AuthController (refresh/logout). Two cookies:
//
//   klubn_rt   — the signed refresh JWT. HttpOnly (JS can NEVER read it -> XSS can't exfil the
//                durable session), SameSite=Strict, Path=/api/auth (only sent to the refresh/logout
//                endpoints), Secure outside Development.
//   klubn_csrf — a random double-submit token. NOT HttpOnly (page JS must read it to echo it in the
//                X-CSRF-Token header on /api/auth/refresh), SameSite=Strict, Path=/, Secure
//                outside Development.
//
// The access token is NEVER a cookie — it lives in the SPA's memory only and is returned in the
// GraphQL login/register response body (the frozen e2e baseline reads it there).
public static class AuthCookies
{
    public const string RefreshCookie = "klubn_rt";
    public const string CsrfCookie = "klubn_csrf";

    // Path scoping limits where each cookie is sent. The refresh JWT only needs to reach
    // /api/auth/* ; the CSRF token must be readable site-wide so the SPA can attach it.
    private const string RefreshPath = "/api/auth";
    private const string CsrfPath = "/";

    public static void SetAuthCookies(
        HttpResponse response, string refreshJwt, string csrfToken, bool isDevelopment, int refreshDays)
    {
        var expires = DateTimeOffset.UtcNow.AddDays(refreshDays);
        var secure = !isDevelopment; // Secure only off in dev (localhost is plain http)

        response.Cookies.Append(RefreshCookie, refreshJwt, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = RefreshPath,
            Expires = expires,
            IsEssential = true
        });

        response.Cookies.Append(CsrfCookie, csrfToken, new CookieOptions
        {
            HttpOnly = false, // JS reads this to echo it in the X-CSRF-Token header (double-submit)
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = CsrfPath,
            Expires = expires,
            IsEssential = true
        });
    }

    // Expire both cookies. MUST match the original Path/SameSite/Secure so the browser deletes the
    // right cookie (a delete with a different Path leaves the original in place).
    public static void ClearAuthCookies(HttpResponse response, bool isDevelopment)
    {
        var secure = !isDevelopment;

        response.Cookies.Append(RefreshCookie, string.Empty, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = RefreshPath,
            Expires = DateTimeOffset.UnixEpoch,
            IsEssential = true
        });

        response.Cookies.Append(CsrfCookie, string.Empty, new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = CsrfPath,
            Expires = DateTimeOffset.UnixEpoch,
            IsEssential = true
        });
    }
}
