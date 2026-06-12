"""E2E — WSx FetchSongMetadata SSRF hardening.

Deterministic checks (no external network egress needed):
  - fetchSongMetadata is no longer anonymous -> "Authentication required." (no anonymous
    caller can drive a server-side outbound fetch).
  - the exact-host allowlist rejects substring-bypass + SSRF-target + non-https URLs BEFORE any
    fetch — the error is always the validation message, never a network/redirect result.

The happy path (a genuine Spotify/SoundCloud oEmbed fetch) needs outbound network and is covered
by the OEmbedHostValidatorTests unit tests instead.

Run (fresh DB + backend running, like the other scripts):
    E2E_BASE_URL=http://localhost:5000 python ssrf_metadata.py
"""
import _harness as h

Q = "query($u:String!){ fetchSongMetadata(url:$u){ title artist coverImageUrl } }"


def _err(r) -> str:
    return " ".join((e.get("message") or "") for e in (r.get("errors") or [])).lower()


def main():
    h.cfg()
    L = h.Ledger("ssrf_metadata")

    # 1) anonymous -> denied by the auth guard, before any host parsing/fetch.
    r = h.gql(Q, {"u": "https://open.spotify.com/track/abc"})
    L.check("fetchSongMetadata anonymous -> Authentication required",
            "authentication required" in _err(r), str(r)[:160])

    tok, _, _ = h.register_user("ssrf")

    # 2) substring-bypass hosts the OLD Contains() gate allowed -> rejected by the exact-host allowlist.
    for bad in ["https://spotify.com.evil.com/x",
                "https://evil.com/#spotify.com",
                "https://evil.com/?soundcloud.com",
                "https://evilsoundcloud.com/x"]:
        r = h.gql(Q, {"u": bad}, tok)
        L.check(f"bypass host rejected (allowlist): {bad}",
                "spotify or soundcloud" in _err(r), str(r)[:160])

    # 3) SSRF targets + non-https -> rejected before any fetch.
    for bad in ["http://169.254.169.254/latest/meta-data/",
                "http://localhost/admin",
                "http://open.spotify.com/track/abc",   # right host, wrong scheme (not https)
                "https://api.spotify.com/v1/tracks/abc"]:  # real domain, not an oEmbed host
        r = h.gql(Q, {"u": bad}, tok)
        L.check(f"ssrf/non-https/non-oembed rejected: {bad}",
                "spotify or soundcloud" in _err(r), str(r)[:160])

    L.done()


if __name__ == "__main__":
    main()
