import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupIpLocation } from '@/lib/geo-ip-database';

/**
 * The address `213.196.109.5` is the one that started all this: Vercel's headers
 * named a Serbian village and a shipped MaxMind database named Belgrade, while
 * ipwho.is and db-ip.com both put it in Niš. These tests pin the two free
 * services and the fallback between them, without touching the network.
 */

const NIS_IP = '213.196.109.5';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function stubFetch(handler: (url: string) => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: unknown) => Promise.resolve(handler(String(input))));
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

const IPWHO_ANSWER = {
  success: true,
  country: 'Serbia',
  country_code: 'RS',
  region: 'Nisava',
  city: 'Nis',
  latitude: 43.3247223,
  longitude: 21.9033327,
};

const DBIP_ANSWER = {
  countryCode: 'RS',
  countryName: 'Serbia',
  stateProv: 'Central Serbia',
  city: 'Niš',
};

beforeEach(() => {
  // The rest of the suite sets this to keep its own tests offline.
  delete process.env.GEOIP_DISABLED;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lookupIpLocation', () => {
  it('asks ipwho.is first and keeps the coordinate it sends', async () => {
    const fetchMock = stubFetch(() => jsonResponse(IPWHO_ANSWER));

    const record = await lookupIpLocation(NIS_IP);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://ipwho.is/${NIS_IP}`);
    expect(record?.provider).toBe('ipwhois');
    expect(record?.city).toBe('Nis');
    expect(record?.countryCode).toBe('RS');
    expect(record?.subdivision).toBe('Nisava');
    expect(record?.latitude).toBeCloseTo(43.32, 1);
  });

  it('falls back to db-ip.com when ipwho.is refuses or is rate-limited', async () => {
    const fetchMock = stubFetch((url) => (
      url.includes('ipwho.is') ? jsonResponse({}, false, 429) : jsonResponse(DBIP_ANSWER)
    ));

    const record = await lookupIpLocation(NIS_IP);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(record?.provider).toBe('dbip');
    expect(record?.city).toBe('Niš');
    // db-ip.com answers a name only; the gazetteer supplies the point.
    expect(record?.latitude).toBeNull();
  });

  it('falls back when ipwho.is answers without a country', async () => {
    stubFetch((url) => (
      url.includes('ipwho.is') ? jsonResponse({ success: false, message: 'reserved range' }) : jsonResponse(DBIP_ANSWER)
    ));

    expect((await lookupIpLocation(NIS_IP))?.provider).toBe('dbip');
  });

  it('returns nothing when both services fail, so the platform headers can answer', async () => {
    const fetchMock = stubFetch(() => jsonResponse({}, false, 503));

    expect(await lookupIpLocation(NIS_IP)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never spends a request on an address that cannot belong to a visitor', async () => {
    const fetchMock = stubFetch(() => jsonResponse(IPWHO_ANSWER));

    expect(await lookupIpLocation('192.168.1.5')).toBeNull();
    expect(await lookupIpLocation('::1')).toBeNull();
    expect(await lookupIpLocation(null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('can be switched off for a suite or an offline deployment', async () => {
    const fetchMock = stubFetch(() => jsonResponse(IPWHO_ANSWER));
    process.env.GEOIP_DISABLED = '1';

    expect(await lookupIpLocation(NIS_IP)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    delete process.env.GEOIP_DISABLED;
  });
});
