import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.SOUNDCHARTS_APP_ID?.trim();
  const appKey = process.env.SOUNDCHARTS_APP_KEY?.trim();

  if (!appId || !appKey) {
    return NextResponse.json(
      { error: 'Ključevi nisu učitani iz .env.local fajla' },
      { status: 400 }
    );
  }

  // Soundcharts nekada traži x-app-id/x-app-key, a nekada x-api-key
  const headers = {
    'x-app-id': appId,
    'x-app-key': appKey,
    'x-api-key': appKey,
    'app_id': appId,
    'app_key': appKey,
    'Accept': 'application/json',
  };

  try {
    const res = await fetch(
      'https://customer.api.soundcharts.com/api/v2/referential/song/genres',
      {
        headers,
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { 
          status: res.status,
          error: 'Soundcharts odbija autentifikaciju', 
          details: errorText,
          usedAppIdPrefix: appId.substring(0, 5) + '...' // Provera da li čita prave vrednosti
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Greška pri konekciji', message: error.message },
      { status: 500 }
    );
  }
}