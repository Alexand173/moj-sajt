import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { pickArtistName } from '@/lib/artist-name';
import { normalizeCityName } from '@/lib/concert-city';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ako ključevi fale tokom build-a, prosleđujemo lažne stringove da TypeScript ne kuka za null,
// ali u GET funkciji hvatamo da li su ključevi pravi!
const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseKey || 'placeholder-key'
);

const US_COUNTRIES = new Set(['US', 'CA']);
const UK_COUNTRIES = new Set(['GB']);
const EUROPA_COUNTRIES = new Set(['DE', 'FR', 'IT', 'ES', 'SE', 'CH', 'AT', 'NL', 'BE', 'PL', 'IE', 'NO', 'DK', 'FI']);
const ASIA_COUNTRIES = new Set(['JP', 'SG', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ']);
const LATINO_COUNTRIES = new Set(['MX', 'BR', 'AR', 'CL', 'CO']);

const REGION_CONFIG: Record<string, { country?: string; genre?: string }> = {
  'us': { country: 'US' },
  'uk': { country: 'GB' },
  'europa': { country: 'DE,FR,IT,ES,SE,CH,AT,NL,BE,PL,IE,NO,DK,FI' },
  'asia': { country: 'JP,SG,KR,CN,HK,TW,AU,NZ' },
  'latino': { country: 'MX,BR,AR,CL,CO' },
  'world': { country: 'ZA,TR,AE,SA,IN,IS' },
  'jazz': { genre: 'KnvZfZ7vAvE' },
  'classical': { genre: 'KnvZfZ7vAeJ' }
};

/**
 * Rows are keyed by `artist_name,date`, so correcting an artist name would insert
 * a second row for a show that is already stored under its event name. Ticketmaster
 * event pages are unique per show, so any stored row sharing a ticket link with an
 * incoming event but carrying a different artist name is the superseded copy.
 */
type IncomingEvent = {
  artist_name: string;
  ticket_link: string | null;
};

type StoredEventRow = {
  id: string | number;
  artist_name: string | null;
  ticket_link: string | null;
};

async function dropSupersededRows(events: IncomingEvent[]): Promise<number> {
  const nextNameByLink = new Map<string, string>();
  for (const event of events) {
    if (event.ticket_link) nextNameByLink.set(event.ticket_link, event.artist_name);
  }

  const links = Array.from(nextNameByLink.keys());
  if (links.length === 0) return 0;

  let removed = 0;

  for (let index = 0; index < links.length; index += 100) {
    const chunk = links.slice(index, index + 100);
    const { data, error } = await supabase
      .from('koncerti')
      .select('id, artist_name, ticket_link')
      .in('ticket_link', chunk);

    if (error || !data) continue;

    const staleIds = (data as StoredEventRow[])
      .filter((row) => row.ticket_link
        && nextNameByLink.get(row.ticket_link)
        && nextNameByLink.get(row.ticket_link) !== row.artist_name)
      .map((row) => row.id);

    if (staleIds.length === 0) continue;

    const { error: deleteError } = await supabase.from('koncerti').delete().in('id', staleIds);
    if (!deleteError) removed += staleIds.length;
  }

  return removed;
}

export async function GET(request: Request) {
  // Ovde bezbedno proveravamo da li imamo prave ekološke promenljive
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ 
      error: "Nedostaju ključevi (URL ili SERVICE_ROLE_KEY) u .env datoteci!" 
    }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'us';

    const config = REGION_CONFIG[region];

    if (!config) {
      return NextResponse.json({ error: `Nepoznat region: ${region}` }, { status: 400 });
    }

    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Nedostaje TICKETMASTER_API_KEY!" }, { status: 500 });
    }

    let allFormattedEvents: any[] = [];

    // ==========================================
    // LOGIKA ZA KLASIKU
    // ==========================================
    if (region === 'classical') {
      const classicalTargetCountries = [
        'US,CA', 
        'GB,DE,FR,IT,ES,SE,CH,AT,NL,BE,PL,IE,NO,DK,FI,JP,SG,KR'
      ];

      for (const countries of classicalTargetCountries) {
        for (let page = 0; page < 5; page++) {
          const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&size=200&page=${page}&segmentName=Music&genreId=KnvZfZ7vAeJ&countryCode=${countries}`;

          const response = await fetch(tmUrl, { cache: 'no-store' });
          const data = await response.json();

          if (data.fault) {
            return NextResponse.json({ status: "Ticketmaster API Greška", fault: data.fault }, { status: 401 });
          }

          const events = data._embedded?.events || [];
          if (events.length === 0) break;

          const formatted = events
            .map((e: any) => {
              return {
                artist_name: pickArtistName(e.name, e._embedded?.attractions?.[0]?.name),
                date: e.dates?.start?.localDate || new Date().toISOString().split('T')[0],
                location: e._embedded?.venues?.[0]?.name || 'TBA',
                city: normalizeCityName(e._embedded?.venues?.[0]?.city?.name),
                region: 'classical',
                ticket_link: e.url || null,
                image_url: e.images?.[0]?.url || null,
              };
            })
            .filter((event: any) => {
              const name = event.artist_name.toLowerCase();
              const cleanFilter = [
                'taylor swift', 'niall horan', 'eagles', 'imagine dragons', 
                'billy joel', 'sting', 'noah kahan', 'shania twain', 'monster jam'
              ];
              return !cleanFilter.some(b => name.includes(b));
            });

          allFormattedEvents = [...allFormattedEvents, ...formatted];
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    } 
    // ==========================================
    // LOGIKA ZA SVE OSTALE REGIONE (I WORLD)
    // ==========================================
    else {
      const totalPages = region === 'world' ? 4 : 3;

      for (let page = 0; page < totalPages; page++) {
        let tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&size=150&page=${page}&segmentName=Music`;

        if (config.country) {
          tmUrl += `&countryCode=${config.country}`;
        }
        if (config.genre) {
          tmUrl += `&genreId=${config.genre}`;
        }

        const response = await fetch(tmUrl, { cache: 'no-store' });
        const data = await response.json();

        if (data.fault) {
          return NextResponse.json({ status: "Ticketmaster API Greška", fault: data.fault }, { status: 401 });
        }

        const events = data._embedded?.events || [];
        if (events.length === 0) break;

        const formatted = events.map((e: any) => {
          const countryCode = (e._embedded?.venues?.[0]?.country?.countryCode || '').toUpperCase();
          let finalRegion = region;

          if (region !== 'classical' && region !== 'jazz' && region !== 'world') {
            if (US_COUNTRIES.has(countryCode)) {
              finalRegion = 'us';
            } else if (UK_COUNTRIES.has(countryCode)) {
              finalRegion = 'uk';
            } else if (EUROPA_COUNTRIES.has(countryCode)) {
              finalRegion = 'europa';
            } else if (ASIA_COUNTRIES.has(countryCode)) {
              finalRegion = 'asia';
            } else if (LATINO_COUNTRIES.has(countryCode)) {
              finalRegion = 'latino';
            }
          }

          return {
            artist_name: pickArtistName(e.name, e._embedded?.attractions?.[0]?.name),
            date: e.dates?.start?.localDate || new Date().toISOString().split('T')[0],
            location: e._embedded?.venues?.[0]?.name || 'TBA',
            city: normalizeCityName(e._embedded?.venues?.[0]?.city?.name),
            region: finalRegion,
            ticket_link: e.url || null,
            image_url: e.images?.[0]?.url || null,
          };
        });

        allFormattedEvents = [...allFormattedEvents, ...formatted];
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    if (allFormattedEvents.length === 0) {
      return NextResponse.json({ message: "Nema novih događaja." });
    }

    let uniqueEvents = Array.from(new Map(
      allFormattedEvents.map((e: any) => [`${e.artist_name}-${e.date}`, e])
    ).values());

    // ==========================================
    // PROVERA PROTIV POSTOJEĆIH U BAZI (SAMO ZA WORLD)
    // ==========================================
    if (region === 'world') {
      const { data: existingDbEvents, error: fetchError } = await supabase
        .from('koncerti')
        .select('artist_name, date')
        .neq('region', 'world'); 

      if (!fetchError && existingDbEvents) {
        const existingKeys = new Set(existingDbEvents.map((e: any) => `${e.artist_name}-${e.date}`));

        uniqueEvents = uniqueEvents.filter((event: any) => {
          const key = `${event.artist_name}-${event.date}`;
          return !existingKeys.has(key);
        });
      }
    }

    if (uniqueEvents.length === 0) {
      return NextResponse.json({ message: "Svi povučeni koncerti već postoje u bazi." });
    }

    const { error: dbError } = await supabase
      .from('koncerti')
      .upsert(uniqueEvents, {
        onConflict: 'artist_name,date'
      });

    if (dbError) {
      return NextResponse.json({
        status: "Greška pri upisu u Supabase bazu",
        poruka: dbError.message,
      }, { status: 500 });
    }

    // Invalidate every /tickets/<region> page after a successful sync.
    revalidatePath('/tickets/[regionName]', 'page');

    // Runs after the write, so a failed upsert can never leave rows deleted.
    const superseded = await dropSupersededRows(uniqueEvents);

    return NextResponse.json({
      status: "Success",
      region,
      fetched: allFormattedEvents.length,
      saved_unique: uniqueEvents.length,
      superseded,
    });

  } catch (err: any) {
    console.error("Kritična greška:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}