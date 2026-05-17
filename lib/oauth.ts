// lib/oauth.ts
export const getOAuthRedirect = () => {
  if (typeof window !== 'undefined') {
    return window.location.hostname.includes('localhost')
      ? 'http://localhost:3000/auth/callback'
      : 'https://www.musictop.net/auth/callback';
  }
  // Fallback (only used if called server‑side, which shouldn't happen)
  return 'https://www.musictop.net/auth/callback';
};