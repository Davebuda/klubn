// P0-WS3B — client-side defense-in-depth for stored-XSS via URL scheme injection. The backend
// scheme allowlist (UrlSchemeValidator) is the authoritative guard on write; this neutralizes any
// already-stored or otherwise-unvalidated value at the render sink.
//
// Returns the URL ONLY when it parses as an absolute http/https URL — otherwise `undefined`, so a
// `javascript:`/`data:`/`vbscript:` (or malformed) value never reaches an `<a href>`. Callers
// render the link hidden/disabled when this returns undefined. Leave static mailto:/tel: config
// links alone (they are not attacker-influenced and are handled separately).
export function safeHttpUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return trimmed;
    }
    return undefined;
  } catch {
    // Not an absolute URL (relative paths, garbage, schemes the URL parser rejects) -> unsafe.
    return undefined;
  }
}
