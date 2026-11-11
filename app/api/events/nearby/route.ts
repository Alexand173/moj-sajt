import { NextResponse } from 'next/server';
import { getRequestLocation } from '@/lib/geo-location';
import { getNearbyEvents } from '@/lib/nearby-events';
import { getTicketRegionLabel } from '@/lib/region-navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Feeds the "Concerts nearby" rail. The page itself stays statically revalidated
 * and calls this once on the client, so a visitor's IP never becomes part of the
 * cached HTML.
 *
 * `?debug=1` reports which layer placed the visitor and what the answer was
 * corrected from, alongside the platform's own opinion — that is how a
 * disagreement between Vercel and the shipped database gets settled from a
 * browser instead of a support thread.
 */

function isDebugAllowed(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get('debug') !== '1') return false;

  if (process.env.NODE_ENV !== 'production') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return (request.headers.get('authorization') || '') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const location = await getRequestLocation(request.headers).catch(() => null);

  try {
    const events = await getNearbyEvents(location);
    const debug = isDebugAllowed(request);

    return NextResponse.json(
      {
        location: location
          ? {
              city: location.city,
              regionKey: location.regionKey,
              regionLabel: getTicketRegionLabel(location.regionKey),
              ...(debug
                ? {
                    source: location.source,
                    snappedFrom: location.snappedFrom ?? null,
                    accuracyRadiusKm: location.accuracyRadiusKm ?? null,
                    countryCode: location.countryCode,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    platform: {
                      city: request.headers.get('x-vercel-ip-city'),
                      country: request.headers.get('x-vercel-ip-country'),
                      latitude: request.headers.get('x-vercel-ip-latitude'),
                      longitude: request.headers.get('x-vercel-ip-longitude'),
                    },
                  }
                : {}),
            }
          : null,
        events,
      },
      {
        // `private` keeps a shared cache from serving one visitor's city to
        // another. Sixty seconds, not five minutes: a corrected lookup that
        // lingers looks exactly like a wrong one.
        headers: { 'Cache-Control': 'private, max-age=60', Vary: 'x-forwarded-for, x-vercel-ip-city' },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown nearby events error.';
    console.error('Nearby events route failed:', message);

    // The rail keeps its slot on an empty list, so a failure degrades to the
    // empty state rather than an error box inside the tickets page.
    return NextResponse.json({ location: null, events: [] }, { status: 200 });
  }
}
