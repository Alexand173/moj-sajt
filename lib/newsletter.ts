const ALLOWED_NEWSLETTER_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns the configured external newsletter signup URL without allowing
 * unsafe protocols to reach an href attribute.
 */
export function getNewsletterSignupUrl(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_NEWSLETTER_URL?.trim();
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    return ALLOWED_NEWSLETTER_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
