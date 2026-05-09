import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase klijenta
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapiranje regiona - UK je GB (ISO standard koji Ticketmaster traži)
const REGION_CONFIG: Record<string, string> = {
  'us': 'US',
  'uk': 'GB',
  'europa': 'DE,FR,IT,ES,SE,CH,AT,NL,BE,PL,IE,NO,DK,FI',
  'asia': 'JP,SG,KR,CN,HK,TW',
  'latino': 'MX,BR,AR,CL,CO'
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'us';
    const countryCodes = REGION_CONFIG[region];

    if (!countryCodes) {
      return NextResponse.json({ error: "Nepoznat region" }, { status: 400 });
    }

    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API ključ nedostaje" }, { status: 500 });
    }

    // Poziv Ticketmaster API-ja
    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&segmentName=Music&countryCode=${countryCodes}&size=50`;
    const response = await fetch(tmUrl);
    const data = await response.json();
    const events = data._embedded?.events || [];

    if (events.length === 0) {
      return NextResponse.json({ message: `Nema novih događaja za ${region}` });
    }

    // Formatiranje podataka
    const formattedEvents = events.map((event: any) => ({
      artist_name: event.name || "Unknown Artist",
      date: event.dates?.start?.localDate || new Date().toISOString().split('T')[0],
      location: event._embedded?.venues?.[0]?.name || 'TBA',
      region: region, // Upisuje region (us, uk, europa...) u bazu
      ticket_link: event.url || null,
      image_url: event.images?.[0]?.url || null,
    }));

    // Upsert u bazu (sprečava duplikate)
    const { error } = await supabase
      .from('koncerti')
      .upsert(formattedEvents, {
        onConflict: 'artist_name,date,region' 
      });

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      status: "Success", 
      region: region, 
      saved: formattedEvents.length 
    });

  } catch (err: any) {
    console.error("General Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}