import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Nalepi tačne ključeve iz tab-a "API Keys (legacy)":
    const appId = "ADADA5-API_4CE17219"; 
    const token = "fa6120bcf8e124c2"; 

    const res = await fetch('https://customer.api.soundcharts.com/api/v2/chart/song/by-platform/spotify', {
      headers: {
        'x-app-id': appId,
        'x-api-key': token,
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}