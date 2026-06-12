using DJDiP.Application.Common;
using Xunit;

namespace DJDiP.Tests
{
    // WSx SSRF hardening — the host allowlist behind Query.FetchSongMetadata. Proves the
    // substring-bypass class is closed and only genuine https Spotify/SoundCloud hosts resolve.
    public class OEmbedHostValidatorTests
    {
        [Theory]
        [InlineData("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", OEmbedProvider.Spotify)]
        [InlineData("https://spotify.com/track/abc", OEmbedProvider.Spotify)]
        [InlineData("https://www.spotify.com/track/abc", OEmbedProvider.Spotify)]
        [InlineData("https://soundcloud.com/artist/track", OEmbedProvider.SoundCloud)]
        [InlineData("https://m.soundcloud.com/artist/track", OEmbedProvider.SoundCloud)]
        [InlineData("https://on.soundcloud.com/abcd", OEmbedProvider.SoundCloud)]
        public void Resolve_accepts_genuine_https_provider_hosts(string url, OEmbedProvider expected)
        {
            Assert.Equal(expected, OEmbedHostValidator.Resolve(url));
        }

        [Theory]
        // substring-bypass attempts (the exact attacks the old Contains() check allowed)
        [InlineData("https://evil.com/#spotify.com")]
        [InlineData("https://spotify.com.evil.com/x")]
        [InlineData("https://evil.com/?soundcloud.com")]
        [InlineData("https://evilsoundcloud.com/x")]
        // SSRF targets
        [InlineData("http://169.254.169.254/latest/meta-data/")]
        [InlineData("http://localhost/admin")]
        [InlineData("https://internal.service.local/secret")]
        // wrong scheme / not a provider
        [InlineData("http://open.spotify.com/track/abc")]   // not https
        [InlineData("javascript:alert(1)")]
        [InlineData("data:text/html,<script>1</script>")]
        [InlineData("ftp://soundcloud.com/x")]
        [InlineData("https://api.spotify.com/v1/tracks/abc")] // real domain, but not an oEmbed host
        [InlineData("not a url")]
        [InlineData("")]
        [InlineData(null)]
        public void Resolve_rejects_bypasses_ssrf_targets_and_non_providers(string? url)
        {
            Assert.Equal(OEmbedProvider.None, OEmbedHostValidator.Resolve(url));
        }
    }
}
