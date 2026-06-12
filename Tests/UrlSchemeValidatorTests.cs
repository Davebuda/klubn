using DJDiP.Application.Common;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS3B — server-side URL-scheme allowlist. The validator is the authoritative XSS guard on
    // the write path (the frontend safeHttpUrl is only defense-in-depth). These assert it rejects
    // the executable schemes (javascript:/data:/other) and accepts legitimate https, and that an
    // OPTIONAL field tolerates empty values (no false positives on omitted urls).
    public class UrlSchemeValidatorTests
    {
        [Fact]
        public void UrlValidation_RejectsJavascriptScheme()
        {
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl("javascript:alert(document.cookie)"));
            // Optional/required validators both throw for a non-empty javascript: URL.
            Assert.Throws<System.InvalidOperationException>(
                () => UrlSchemeValidator.ValidateRequired("javascript:alert(1)", "mixUrl"));
            Assert.Throws<System.InvalidOperationException>(
                () => UrlSchemeValidator.ValidateOptional("JavaScript:alert(1)", "mixUrl"));
        }

        [Fact]
        public void UrlValidation_RejectsDataScheme()
        {
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl(
                "data:text/html,<script>alert(1)</script>"));
            Assert.Throws<System.InvalidOperationException>(
                () => UrlSchemeValidator.ValidateRequired(
                    "data:text/html;base64,PHNjcmlwdD4=", "imageUrl"));
        }

        [Fact]
        public void UrlValidation_RejectsNonHttpScheme()
        {
            // Other dangerous/irrelevant schemes and relative paths are all rejected.
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl("vbscript:msgbox(1)"));
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl("file:///etc/passwd"));
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl("ftp://example.com/x"));
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl("/relative/path"));
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl("mailto:hi@example.com"));
        }

        [Fact]
        public void UrlValidation_AcceptsValidHttpsUrl()
        {
            Assert.True(UrlSchemeValidator.IsSafeHttpUrl("https://open.spotify.com/track/abc"));
            Assert.True(UrlSchemeValidator.IsSafeHttpUrl("http://example.com/path?q=1"));
            // ValidateRequired does not throw on a legitimate value (no false positive).
            UrlSchemeValidator.ValidateRequired("https://klubn.no/tickets", "ticketingUrl");
            UrlSchemeValidator.ValidateOptional("https://klubn.no/tickets", "ticketingUrl");
        }

        [Fact]
        public void UrlValidation_AllowsEmptyOptional()
        {
            // An omitted optional URL field is fine — only non-empty values are scheme-checked.
            Assert.True(UrlSchemeValidator.IsSafeOrEmpty(null));
            Assert.True(UrlSchemeValidator.IsSafeOrEmpty(""));
            Assert.True(UrlSchemeValidator.IsSafeOrEmpty("   "));
            UrlSchemeValidator.ValidateOptional(null, "thumbnailUrl");
            UrlSchemeValidator.ValidateOptional("", "thumbnailUrl");
            // But a REQUIRED field rejects empty.
            Assert.False(UrlSchemeValidator.IsSafeHttpUrl(null));
        }
    }
}
