const DEFAULT_SITE_ORIGIN = 'https://musictop.net';

function isLocalOrigin(origin: Location): boolean {
  return origin.hostname === 'localhost'
    || origin.hostname === '127.0.0.1'
    || origin.hostname === '[::1]';
}

export const getOAuthRedirect = () => {
  if (typeof window === 'undefined') {
    return `${DEFAULT_SITE_ORIGIN}/auth/callback`;
  }

  // Production is canonicalized from www.musictop.net to musictop.net by the
  // edge. Use the canonical callback so the redirect query is not discarded
  // before /auth/callback can exchange the authorization code.
  const origin = isLocalOrigin(window.location) ? window.location.origin : DEFAULT_SITE_ORIGIN;
  return `${origin}/auth/callback`;
};
