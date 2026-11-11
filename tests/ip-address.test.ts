import { describe, expect, it } from 'vitest';
import { isPublicIpAddress, normalizeIpAddress } from '@/lib/ip-address';

/**
 * Forwarded headers carry more than an address: a port, brackets around IPv6,
 * quotes, and the IPv4-mapped form Node reports when a socket is dual-stack.
 * Every one of those passed straight to MaxMind yields "no record", which is
 * indistinguishable from a database failure — this is the layer that stops that.
 */

describe('normalizeIpAddress', () => {
  it('unwraps the shapes a proxy writes around an address', () => {
    expect(normalizeIpAddress('203.0.113.9:51514')).toBe('203.0.113.9');
    expect(normalizeIpAddress('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(normalizeIpAddress('[2001:db8::1]')).toBe('2001:db8::1');
    expect(normalizeIpAddress('"203.0.113.9"')).toBe('203.0.113.9');
    expect(normalizeIpAddress('  203.0.113.9  ')).toBe('203.0.113.9');
  });

  it('reads an IPv4-mapped IPv6 address as the IPv4 address it is', () => {
    expect(normalizeIpAddress('::ffff:203.0.113.9')).toBe('203.0.113.9');
  });

  it('lower-cases IPv6 so one address has one spelling', () => {
    expect(normalizeIpAddress('2001:DB8::ABCD')).toBe('2001:db8::abcd');
  });

  it('returns nothing for an empty or missing value', () => {
    expect(normalizeIpAddress('')).toBeNull();
    expect(normalizeIpAddress('   ')).toBeNull();
    expect(normalizeIpAddress(null)).toBeNull();
  });
});

describe('isPublicIpAddress', () => {
  it('accepts the address a visitor actually arrives from', () => {
    expect(isPublicIpAddress('203.0.113.9')).toBe(true);
    expect(isPublicIpAddress('213.196.109.5')).toBe(true);
    expect(isPublicIpAddress('2001:db8::1')).toBe(true);
  });

  it('refuses every range that cannot belong to a visitor', () => {
    expect(isPublicIpAddress('127.0.0.1')).toBe(false);
    expect(isPublicIpAddress('10.1.2.3')).toBe(false);
    expect(isPublicIpAddress('172.20.0.1')).toBe(false);
    expect(isPublicIpAddress('192.168.1.5')).toBe(false);
    expect(isPublicIpAddress('169.254.10.1')).toBe(false);
    expect(isPublicIpAddress('0.0.0.0')).toBe(false);
    expect(isPublicIpAddress('::1')).toBe(false);
    expect(isPublicIpAddress('fe80::1')).toBe(false);
    expect(isPublicIpAddress('fd00::1')).toBe(false);
  });

  it('refuses carrier-grade NAT, which is a shared address rather than a person', () => {
    // 100.64.0.0/10 is what a mobile carrier hands a handset behind its NAT.
    expect(isPublicIpAddress('100.64.3.4')).toBe(false);
    expect(isPublicIpAddress('100.127.255.254')).toBe(false);
    // The neighbouring public space is still public.
    expect(isPublicIpAddress('100.128.0.1')).toBe(true);
  });

  it('reads through the wrapping before deciding', () => {
    expect(isPublicIpAddress('[2001:db8::1]:443')).toBe(true);
    expect(isPublicIpAddress('::ffff:10.0.0.1')).toBe(false);
  });
});
