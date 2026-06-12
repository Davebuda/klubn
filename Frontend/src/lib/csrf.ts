// P0-WS3B — read the non-HttpOnly `klubn_csrf` cookie so the SPA can echo it in the
// `X-CSRF-Token` header on the cookie-bearing /api/auth/refresh + /api/auth/logout calls
// (double-submit CSRF defense). The refresh token cookie (`klubn_rt`) is HttpOnly and is
// intentionally NOT readable here — only the backend ever sees it.
export const CSRF_COOKIE = 'klubn_csrf';

export function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${CSRF_COOKIE}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}
