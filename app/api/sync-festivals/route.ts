import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'us';
    
    // Ticketmaster API poziv
    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&segmentName=Festivals&countryCode=${region.toUpperCase()}&size=50`;
    
    const response = await fetch(tmUrl);
    const data = await response.json();
    const events = data._embedded?.events || [];

    if (events.length === 0) return NextResponse.json({ message: "Nema festivala" });

    // 1. Mapiranje podataka (ovo je ključno da se poklapa sa tvojom bazom)
    const formatted = events.map((e: any) => ({
      name: e.name,
      date_start: e.dates?.start?.localDate,
      location: e._embedded?.venues?.[0]?.name || 'TBA',
      region: region.toLowerCase(),
      tickets_url: e.url,
      description: e.info || "No description available",
      video_id: e._embedded?.videos?.[0]?.id || null, // Ako postoji
      image_url: e.images?.map((img: any) => img.url) || [], // Niz slika
      lineup: e._embedded?.attractions?.map((a: any) => a.name) || [] // Niz izvođača
    }));

    // 2. FILTRIRANJE DUPLIKATA (OVO REŠAVA TVOJU GREŠKU)
    const uniqueMap = new Map();
    formatted.forEach((item: any) => {
        // Ključ po kojem proveravamo duplikate
        const key = `${item.name}-${item.date_start}-${item.region}`;
        uniqueMap.set(key, item);
    });
    const cleanData = Array.from(uniqueMap.values());

    // 3. Upsert u bazu
    const { error } = await supabase
      .from('festivals')
      .upsert(cleanData, { 
        onConflict: 'name,date_start,region' // Mora da bude isto kao u SQL indeksu!
      });

    if (error) throw error;

    return NextResponse.json({ status: "Success", region, saved: cleanData.length });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}