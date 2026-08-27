export const getOAuthRedirect = () => {
  // Keep local OAuth on the exact dev host and port. Production keeps the
  // existing www callback that must be allow-listed in Supabase Auth.
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `${window.location.origin}/auth/callback`;
  }

  return 'https://www.musictop.net/auth/callback';
};