// A social link counts as "real" only when it points at an actual profile.
// Two things disqualify a value: it's empty, or it's a bare placeholder domain
// (e.g. earlier defaults seeded settings with "https://instagram.com"). Bare-domain
// values are treated as "no link yet" so the icon stays hidden until an admin pastes
// a real profile URL in Site Settings. This keeps the public site showing ONLY the
// social tabs that have been given a genuine link.
const PLACEHOLDER_HOSTS = new Set([
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'soundcloud.com',
  'spotify.com',
]);

export const isRealSocialUrl = (raw?: string | null): boolean => {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, ''); // drop trailing slash(es)

    // Bare domain with no profile path/query == placeholder, not a real link.
    if (PLACEHOLDER_HOSTS.has(host) && path === '' && !url.search) return false;

    return true;
  } catch {
    return false;
  }
};
