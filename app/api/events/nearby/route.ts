import { NextResponse } from 'next/server';
import { getRequestLocation } from '@/lib/geo-location';
import { getNearbyEvents } from '@/lib/nearby-events';
import { getTicketRegionLabel } from '@/lib/region-navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Feeds the "Trending near you" rail. The page itself stays statically
 * revalidated and calls this once on the client, so a visitor's IP never becomes
 * part of the cached HTML.
 */
export async function GET(request: Request) {
  const location = await getRequestLocation(request.headers).catch(() => null);

  try {
    const events = await getNearbyEvents(location);

    return NextResponse.json(
      {
        location: location
          ? {
              city: location.city,
              regionKey: location.regionKey,
              regionLabel: getTicketRegionLabel(location.regionKey),
            }
          : null,
        events,
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown nearby events error.';
    console.error('Nearby events route failed:', message);

    // The rail hides itself on an empty list, so a failure degrades to no section
    // rather than an error box inside the tickets page.
    return NextResponse.json({ location: null, events: [] }, { status: 200 });
  }
}
