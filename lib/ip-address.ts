/**
 * Is this address one that can belong to a visitor?
 *
 * Private, loopback and link-local ranges cannot be geolocated: asking a
 * database about `192.168.1.5` returns nothing or, worse, something. Both the
 * platform-header path and the database path need this test, so it lives on its
 * own rather than in either of them.
 */

export function isPublicIpAddress(value: string | null | undefined): boolean {
  if (!value) return false;

  // IPv6: loopback (`::1`) and the unique-local / link-local prefixes.
  if (value.includes(':')) {
    return !/^(::1|fe80|fc|fd)/i.test(value);
  }

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  if (value === '0.0.0.0' || value.startsWith('127.') || value.startsWith('10.') || value.startsWith('169.254.')) return false;
  if (value.startsWith('192.168.')) return false;

  const private172 = /^172\.(\d{1,3})\./.exec(value);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;

  return true;
}
