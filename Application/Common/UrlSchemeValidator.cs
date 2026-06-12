namespace DJDiP.Application.Common
{
    // P0-WS3B (XSS -> token theft breaker). Server-side URL-scheme allowlist applied on WRITE
    // across ingest + every DJ/song/site-settings/playlist/application save path. This is the
    // authoritative guard; the frontend `safeHttpUrl` is defense-in-depth, not the only check.
    //
    // A "safe" URL is an ABSOLUTE http/https URI. Everything else is rejected: `javascript:`,
    // `data:`, `vbscript:`, `file:`, mailto/tel, relative paths, and empty/whitespace. Optional
    // fields validate ONLY when non-empty (callers use IsSafeOrEmpty / ValidateOptional for those).
    public static class UrlSchemeValidator
    {
        // True ONLY for an absolute http/https URL. False for null/empty, relative, or any other
        // scheme. Uses Uri parsing (not string sniffing) so encoded/odd-cased schemes are caught.
        public static bool IsSafeHttpUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return false;
            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return false;
            return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
        }

        // True when the value is EITHER empty/whitespace (an omitted optional field) OR a safe
        // http/https URL. Use this to validate optional URL fields without forcing a value.
        public static bool IsSafeOrEmpty(string? url)
            => string.IsNullOrWhiteSpace(url) || IsSafeHttpUrl(url);

        // Validate-or-throw for a REQUIRED url. Throws InvalidOperationException (the convention
        // the resolvers/controllers already map to a clean GraphQL/HTTP error) when unsafe.
        public static void ValidateRequired(string? url, string fieldName)
        {
            if (!IsSafeHttpUrl(url))
                throw new InvalidOperationException(
                    $"{fieldName} must be a valid http(s) URL.");
        }

        // Validate-or-throw for an OPTIONAL url: empty/null passes; a non-empty value must be a
        // safe http/https URL.
        public static void ValidateOptional(string? url, string fieldName)
        {
            if (!IsSafeOrEmpty(url))
                throw new InvalidOperationException(
                    $"{fieldName} must be a valid http(s) URL.");
        }
    }
}
