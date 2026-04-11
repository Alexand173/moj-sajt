import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicijalizacija Supabase-a sa Service Role ključem (bitno za upis)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// 1. FUNKCIJA KOJA TRAŽI VIDEO PREKO YOUTUBE API-JA
async function fetchYouTubeId(festivalName: string) {
  if (!YOUTUBE_API_KEY) return 'mH-v_Y5Uf_o'; // Fallback ako nema ključa

  const query = encodeURIComponent(`${festivalName} official aftermovie 2024 2025`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.items?.[0]?.id?.videoId || 'mH-v_Y5Uf_o';
  } catch (error) {
    console.error(`Error fetching video for ${festivalName}:`, error);
    return 'mH-v_Y5Uf_o';
  }
}

export async function GET() {
  // 2. TVOJI PODACI (Ovo možeš dopuniti sa više festivala)
  const rawFestivals = [
    {
      name: 'Coachella 2026',
      region: 'us',
      location: 'Indio, California',
      date_start: '2026-04-10',
      description: 'The premier global music and arts festival at Empire Polo Club.',
      lineup: ['Lana Del Rey', 'Tyler, The Creator', 'Doja Cat', 'No Doubt'],
      tickets_url: 'https://www.ticketmaster.com',
      image_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3'
    },
    {
      name: 'Lollapalooza 2026',
      region: 'us',
      location: 'Chicago, Illinois',
      date_start: '2026-08-01',
      description: 'Multi-genre music festival in the heart of Grant Park.',
      lineup: ['Metallica', 'Dua Lipa', 'J. Cole', 'Green Day'],
      tickets_url: 'https://www.lollapalooza.com',
      image_url: 'https://images.unsplash.com/photo-1459749411177-042180ce673f'
    }
  ];

  try {
    // 3. PROLAZIMO KROZ SVAKI FESTIVAL I DODAJEMO VIDEO_ID
    const festivalsToUpload = await Promise.all(
      rawFestivals.map(async (fest) => {
        const video_id = await fetchYouTubeId(fest.name);
        return { ...fest, video_id };
      })
    );

    // 4. UPIS U BAZU
    // Koristimo .upsert() sa onConflict: 'name' 
    // VAŽNO: Moraš imati UNIQUE constraint na koloni 'name' u Supabase-u
    const { data, error } = await supabase
      .from('festivals')
      .upsert(festivalsToUpload, { onConflict: 'name' });

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Successfully scraped and updated videos!", 
      count: festivalsToUpload.length,
      data: festivalsToUpload 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// OSIGURAVA DA NEXT.JS NE KEŠIRA OVU RUTU
export const dynamic = 'force-dynamic';