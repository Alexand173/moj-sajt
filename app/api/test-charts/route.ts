import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const appId = process.env.SOUNDCHARTS_APP_ID?.trim();
  const appKey = process.env.SOUNDCHARTS_APP_KEY?.trim();

  if (!appId || !appKey) {
    return NextResponse.json(
      { error: 'Missing SOUNDCHARTS_APP_ID or SOUNDCHARTS_APP_KEY.' },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      'https://customer.api.soundcharts.com/api/v2/chart/song/by-platform/spotify',
      {
        headers: {
          'x-app-id': appId,
          'x-app-key': appKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Soundcharts error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
