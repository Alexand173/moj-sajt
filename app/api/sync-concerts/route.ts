import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REGION_CONFIG: Record<string, string> = {
  'us': 'US',
  'uk': 'GB',
  'europa': 'DE,FR,IT,ES,SE,CH,AT,NL,BE,PL,IE,NO,DK,FI',
  'asia': 'JP,SG,KR,CN,HK,TW,AU,NZ',
  'latino': 'MX,BR,AR,CL,CO'
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'us';
    const countryCodes = REGION_CONFIG[region];

    if (!countryCodes) return NextResponse.json({ error: "Nepoznat region" }, { status: 400 });

    const apiKey = process.env.TICKETMASTER_API_KEY;
    let allFormattedEvents: any[] = [];

    // PETLJA: Idemo 5 puta po 200 da dobijemo 1000
    for (let page = 0; page < 5; page++) {
      const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&segmentName=Music&countryCode=${countryCodes}&size=200&page=${page}`;
      
      const response = await fetch(tmUrl);
      const data = await response.json();
      const events = data._embedded?.events || [];

      if (events.length === 0) break; // Ako nema više rezultata, prekini petlju

      const formatted = events.map((e: any) => ({
        artist_name: e.name || "Unknown",
        date: e.dates?.start?.localDate || new Date().toISOString().split('T')[0],
        location: e._embedded?.venues?.[0]?.name || 'TBA',
        region: region,
        ticket_link: e.url || null,
        image_url: e.images?.[0]?.url || null,
      }));

      allFormattedEvents = [...allFormattedEvents, ...formatted];

      // Mala pauza od 200ms da nas Ticketmaster ne blokira zbog prebrzih zahteva
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (allFormattedEvents.length === 0) {
      return NextResponse.json({ message: "Nema novih događaja" });
    }

    // Uklanjanje duplikata (ako isti bend ima isti datum u istom regionu)
    const uniqueEvents = Array.from(new Map(
      allFormattedEvents.map((e: any) => [`${e.artist_name}-${e.date}-${region}`, e])
    ).values());

    // Slanje u Supabase (Upsert)
    const { error } = await supabase
      .from('koncerti')
      .upsert(uniqueEvents, {
        onConflict: 'artist_name,date,region'
      });

    if (error) throw error;

    return NextResponse.json({ 
      status: "Success", 
      region, 
      fetched: allFormattedEvents.length, 
      saved_unique: uniqueEvents.length 
    });

  } catch (err: any) {
    console.error("Greška:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}