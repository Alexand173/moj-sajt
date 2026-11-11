import { NextResponse, type NextRequest } from 'next/server';
import { lookupIpLocation } from '@/lib/geo-ip-database';
import { describeRequestIp, getRequestLocation, locationFromIpRecord } from '@/lib/geo-location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the server knows about this request's location — the whole ladder, one
 * request.
 *
 * "The site is not using my IP" cannot be answered from the rendered page: a
 * city on screen looks identical whether db-ip.com, a platform header, a proxy
 * or a fallback provider produced it, and that difference decides what to fix.
 * So: every address header the request carries, which one was used, what
 * db-ip.com answered for it, and what the ladder finally returned.
 *
 * Only the caller's own address is reported. Checking someone else's needs
 * `?ip=` with the cron secret, for a report from a visitor in a country none of
 * us are in.
 */

function probeAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return (request.headers.get('authorization') || '') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('ip')?.trim() || null;
  if (requested && !probeAllowed(request)) {
    return NextResponse.json(
      { error: 'probe-needs-authorization' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const address = describeRequestIp(request.headers);
  const target = requested ?? address.ip;

  const [record, resolved] = await Promise.all([
    lookupIpLocation(target),
    requested ? null : getRequestLocation(request.headers).catch(() => null),
  ]);

  return NextResponse.json(
    {
      address: {
        used: target,
        source: requested ? 'query' : address.header,
        candidates: address.candidates,
      },
      lookup: {
        service: 'db-ip.com',
        // The paid endpoint is used only when a key is configured.
        keyed: Boolean(process.env.DBIP_API_KEY),
        record,
        resolved: record ? locationFromIpRecord(record) : null,
      },
      platform: {
        city: request.headers.get('x-vercel-ip-city'),
        country: request.headers.get('x-vercel-ip-country'),
        latitude: request.headers.get('x-vercel-ip-latitude'),
        longitude: request.headers.get('x-vercel-ip-longitude'),
      },
      ladder: resolved
        ? {
            city: resolved.city,
            source: resolved.source,
            snappedFrom: resolved.snappedFrom ?? null,
            regionKey: resolved.regionKey,
          }
        : null,
    },
    {
      // One visitor's request, one answer: caching would be a lie by the next
      // request and a leak by the next visitor.
      headers: { 'Cache-Control': 'private, no-store', Vary: 'x-forwarded-for' },
    },
  );
}
