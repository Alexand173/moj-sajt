/**
 * Is this address one that can belong to a visitor?
 *
 * Private, loopback and link-local ranges cannot be geolocated: asking a
 * database about `192.168.1.5` returns nothing or, worse, something. Both the
 * platform-header path and the database path need this test, so it lives on its
 * own rather than in either of them.
 */

/**
 * The address inside whatever a proxy wrote around it.
 *
 * Forwarded headers arrive in several shapes and all of them mean one address:
 * `203.0.113.9`, `203.0.113.9:51514`, `[2001:db8::1]:443`,
 * `[2001:db8::1]` and `::ffff:203.0.113.9`. Passing any of those straight to
 * MaxMind yields "no record", which looks exactly like a database failure — so
 * a malformed input must never reach the reader silently.
 */
export function normalizeIpAddress(value: string | null | undefined): string | null {
  if (!value) return null;

  let candidate = value.trim().replace(/^"|"$/g, '');
  if (!candidate) return null;

  // `[2001:db8::1]:443` and `[2001:db8::1]`
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(candidate);
  if (bracketed) candidate = bracketed[1];

  // `::ffff:203.0.113.9` is an IPv4 address wearing an IPv6 prefix.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(candidate);
  if (mapped) candidate = mapped[1];

  // `203.0.113.9:51514`
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(candidate);
  if (withPort) candidate = withPort[1];

  return candidate.includes(':') ? candidate.toLowerCase() : candidate;
}

/** `100.64.0.0/10` is carrier-grade NAT: a shared address, never a visitor's own. */
function isCarrierGradeNat(value: string): boolean {
  const match = /^100\.(\d{1,3})\./.exec(value);
  if (!match) return false;

  const second = Number(match[1]);
  return second >= 64 && second <= 127;
}

export function isPublicIpAddress(value: string | null | undefined): boolean {
  const ip = normalizeIpAddress(value);
  if (!ip) return false;

  // IPv6: loopback (`::1`), the unspecified address and the unique-local /
  // link-local prefixes.
  if (ip.includes(':')) {
    return !/^(::1|::$|fe80|fec0|fc|fd)/i.test(ip);
  }

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  if (ip === '0.0.0.0' || ip === '255.255.255.255') return false;
  if (/^0\./.test(ip) || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('169.254.')) return false;
  if (ip.startsWith('192.168.')) return false;
  if (isCarrierGradeNat(ip)) return false;

  const private172 = /^172\.(\d{1,3})\./.exec(ip);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;

  return true;
}
