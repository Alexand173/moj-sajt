const DEFAULT_SITE_ORIGIN = 'https://musictop.net';

export const getOAuthRedirect = () => {
  if (typeof window === 'undefined') {
    return `${DEFAULT_SITE_ORIGIN}/auth/callback`;
  }

  // Keep the callback on the exact origin the user is currently visiting.
  // This avoids losing the authorization code when www.musictop.net is
  // canonicalized to musictop.net before the callback can exchange it.
  return `${window.location.origin}/auth/callback`;
};
