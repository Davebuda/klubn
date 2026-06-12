using DJDiP.Application.Common;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS3C (GDPR) — log PII masking. MaskEmail keeps the first char of the local part +
    // the domain, masking the rest, so common flows can log a non-identifying value. These pin
    // the canonical shape and the edge cases (LogMask_MasksEmailAddress).
    public class PiiMaskerTests
    {
        [Fact]
        public void MaskEmail_MasksLocalPartAndKeepsDomain()
        {
            Assert.Equal("j***@klubn.no", PiiMasker.MaskEmail("john@klubn.no"));
            Assert.Equal("a***@b.com", PiiMasker.MaskEmail("alice@b.com"));
        }

        [Fact]
        public void LogMask_MasksEmailAddress()
        {
            // The masked output must NOT contain the full local part — only the first char survives.
            var masked = PiiMasker.MaskEmail("sensitive.user@example.com");
            Assert.Equal("s***@example.com", masked);
            Assert.DoesNotContain("sensitive.user", masked);
        }

        [Theory]
        [InlineData(null, "(none)")]
        [InlineData("", "(none)")]
        [InlineData("   ", "(none)")]
        [InlineData("notanemail", "***")]      // no '@' -> never echoed verbatim
        [InlineData("@nolocal.com", "***")]    // empty local part
        [InlineData("trailing@", "***")]       // empty domain
        [InlineData("x@y.io", "x***@y.io")]    // single-char local part
        public void MaskEmail_HandlesEdgeCases(string? input, string expected)
        {
            Assert.Equal(expected, PiiMasker.MaskEmail(input));
        }

        [Fact]
        public void MaskEmail_TrimsWhitespaceBeforeMasking()
        {
            Assert.Equal("j***@klubn.no", PiiMasker.MaskEmail("  john@klubn.no  "));
        }
    }
}
