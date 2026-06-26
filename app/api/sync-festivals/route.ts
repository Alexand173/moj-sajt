import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Reči zbog kojih automatski brišemo događaj jer nije muzički festival
const FORBIDDEN_KEYWORDS = [
  'comedy', 'dino', 'dinosaur', 'expo', 'food', 'wine', 'beer', 
  'exhibition', 'museum', 'theater', 'circus', 'magician', 
  'basketball', 'tennis', 'match', 'monster jam', 'globetrotters'
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'us';
    
    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&classificationId=KZFzniwnSyZfZ7v7n1&countryCode=${region.toUpperCase()}&size=50`;
    
    const response = await fetch(tmUrl);
    const data = await response.json();
    const events = data._embedded?.events || [];

    if (events.length === 0) return NextResponse.json({ message: "Nema festivala" });

    // 1. Mapiranje i čišćenje nemuzičkih događaja
    const formatted = events
      .map((e: any) => {
        const name = e.name || '';
        const description = e.info || "No description available";
        const lineup = e._embedded?.attractions?.map((a: any) => a.name) || [];

        // Provera da li ime ili opis sadrže zabranjene reči
        const isForbidden = FORBIDDEN_KEYWORDS.some(keyword => 
          name.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword)
        );

        // Ako sadrži zabranjenu reč ILI nema uopšte line-up izvođača, preskačemo ga
        if (isForbidden || lineup.length === 0) {
          return null; 
        }

        return {
          name: name,
          date_start: e.dates?.start?.localDate,
          location: e._embedded?.venues?.[0]?.name || 'TBA',
          region: region.toLowerCase(),
          tickets_url: e.url,
          description: description,
          video_id: e._embedded?.videos?.[0]?.id || null, 
          image_url: e.images?.map((img: any) => img.url) || [],
          lineup: lineup
        };
      })
      .filter((item: any) => item !== null); // Izbacujemo sve null vrednosti

    if (formatted.length === 0) return NextResponse.json({ message: "Nema validnih muzičkih festivala nakon filtriranja." });

    // 2. FILTRIRANJE DUPLIKATA PO IMENU
    const uniqueMap = new Map();
    formatted.forEach((item: any) => {
        const key = item.name;
        uniqueMap.set(key, item);
    });
    const cleanData = Array.from(uniqueMap.values());

    // 3. Upsert u bazu
    const { error } = await supabase
      .from('festivals')
      .upsert(cleanData, { 
        onConflict: 'name'
      });

    if (error) throw error;

    return NextResponse.json({ status: "Success", region, saved: cleanData.length });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';