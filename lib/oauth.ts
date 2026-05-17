export const getOAuthRedirect = () => {
  // This function must only be called from the client side ('use client')
  if (typeof window !== 'undefined') {
    return window.location.hostname.includes('localhost')
      ? 'http://localhost:3000/auth/callback'
      : 'https://www.musictop.net/auth/callback';
  }
  // Fallback, but should never be reached in a properly configured client component
  return 'https://www.musictop.net/auth/callback';
};