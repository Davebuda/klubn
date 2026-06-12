namespace DJDiP.Application.Common
{
    public enum OEmbedProvider
    {
        None,
        Spotify,
        SoundCloud
    }

    // WSx SSRF hardening for Query.FetchSongMetadata. The old gate was a substring
    // `url.Contains("spotify.com")`, which a crafted URL bypasses
    // (https://evil.com/#spotify.com, https://spotify.com.evil.com, https://evil.com/?soundcloud.com).
    // This validator parses the URL and matches the **exact host** against an allowlist, and
    // requires https — so only genuine Spotify/SoundCloud links resolve to a provider; everything
    // else returns None and is rejected before any server-side fetch.
    public static class OEmbedHostValidator
    {
        private static readonly HashSet<string> SpotifyHosts = new(StringComparer.OrdinalIgnoreCase)
        {
            "open.spotify.com", "spotify.com", "www.spotify.com"
        };

        private static readonly HashSet<string> SoundCloudHosts = new(StringComparer.OrdinalIgnoreCase)
        {
            "soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"
        };

        public static OEmbedProvider Resolve(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return OEmbedProvider.None;
            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return OEmbedProvider.None;
            if (uri.Scheme != Uri.UriSchemeHttps) return OEmbedProvider.None;

            if (SpotifyHosts.Contains(uri.Host)) return OEmbedProvider.Spotify;
            if (SoundCloudHosts.Contains(uri.Host)) return OEmbedProvider.SoundCloud;
            return OEmbedProvider.None;
        }
    }
}
