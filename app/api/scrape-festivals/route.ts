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
  { name: 'Coachella 2026', region: 'us', location: 'Indio, CA', date_start: '2026-04-10', description: 'Premier music and arts festival.', lineup: ['Lana Del Rey', 'Tyler, The Creator'], tickets_url: 'https://coachella.com', image_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3' },
  { name: 'EDC Las Vegas 2026', region: 'us', location: 'Las Vegas, NV', date_start: '2026-05-15', description: 'Massive EDM experience.', lineup: ['Tiësto', 'David Guetta'], tickets_url: 'https://lasvegas.electricdaisycarnival.com', image_url: 'https://images.unsplash.com/photo-1540340061722-9293d5163008' },
  { name: 'Bonnaroo 2026', region: 'us', location: 'Manchester, TN', date_start: '2026-06-11', description: 'Iconic farm festival.', lineup: ['Red Hot Chili Peppers'], tickets_url: 'https://bonnaroo.com', image_url: 'https://images.unsplash.com/photo-1470229722910-72e2d0673d3d' },
  { name: 'Lollapalooza 2026', region: 'us', location: 'Chicago, IL', date_start: '2026-08-01', description: 'Grant Park multi-genre.', lineup: ['Metallica', 'Dua Lipa'], tickets_url: 'https://lollapalooza.com', image_url: 'https://images.unsplash.com/photo-1459749411177-042180ce673f' },
  { name: 'Austin City Limits 2026', region: 'us', location: 'Austin, TX', date_start: '2026-10-02', description: 'Zilker Park diversity.', lineup: ['Foo Fighters', 'SZA'], tickets_url: 'https://aclfestival.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Governors Ball 2026', region: 'us', location: 'New York, NY', date_start: '2026-06-05', description: 'NYC premier festival.', lineup: ['Kendrick Lamar'], tickets_url: 'https://govball.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Firefly Music Festival 2026', region: 'us', location: 'Dover, DE', date_start: '2026-06-18', description: 'The Woodlands experience.', lineup: ['Halsey'], tickets_url: 'https://fireflyfestival.com', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Outside Lands 2026', region: 'us', location: 'San Francisco, CA', date_start: '2026-08-07', description: 'Golden Gate Park vibes.', lineup: ['The Killers'], tickets_url: 'https://sfoutsidelands.com', image_url: 'https://images.unsplash.com/photo-1496883001408-55445e782e2c' },
  { name: 'Electric Forest 2026', region: 'us', location: 'Rothbury, MI', date_start: '2026-06-25', description: 'Immersive forest art.', lineup: ['String Cheese Incident'], tickets_url: 'https://electricforest.com', image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c24b064d' },
  { name: 'Ultra Music Festival 2026', region: 'us', location: 'Miami, FL', date_start: '2026-03-27', description: 'Global electronic leader.', lineup: ['Armin van Buuren'], tickets_url: 'https://ultramusicfestival.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Rolling Loud Miami 2026', region: 'us', location: 'Miami, FL', date_start: '2026-07-24', description: 'Hip-hop showcase.', lineup: ['Travis Scott'], tickets_url: 'https://rollingloud.com', image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552' },
  { name: 'Stagecoach 2026', region: 'us', location: 'Indio, CA', date_start: '2026-04-24', description: 'Country music giant.', lineup: ['Luke Combs'], tickets_url: 'https://stagecoachfestival.com', image_url: 'https://images.unsplash.com/photo-1594993877183-5154365518b2' },
  { name: 'New Orleans Jazz Fest 2026', region: 'us', location: 'New Orleans, LA', date_start: '2026-04-23', description: 'Culture and jazz legacy.', lineup: ['Jon Batiste'], tickets_url: 'https://nojazzfest.com', image_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629' },
  { name: 'SXSW 2026', region: 'us', location: 'Austin, TX', date_start: '2026-03-13', description: 'Film, tech, and music.', lineup: ['Various'], tickets_url: 'https://sxsw.com', image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30' },
  { name: 'Summerfest 2026', region: 'us', location: 'Milwaukee, WI', date_start: '2026-06-25', description: 'World largest festival.', lineup: ['Imagine Dragons'], tickets_url: 'https://summerfest.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Riot Fest 2026', region: 'us', location: 'Chicago, IL', date_start: '2026-09-18', description: 'Punk and alternative.', lineup: ['The Cure'], tickets_url: 'https://riotfest.org', image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c24b064d' },
  { name: 'Pitchfork Music Festival 2026', region: 'us', location: 'Chicago, IL', date_start: '2026-07-17', description: 'Indie and underground.', lineup: ['Bon Iver'], tickets_url: 'https://pitchforkmusicfestival.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Desert Daze 2026', region: 'us', location: 'Lake Perris, CA', date_start: '2026-10-10', description: 'Psych and rock.', lineup: ['Tame Impala'], tickets_url: 'https://desertdaze.org', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Boston Calling 2026', region: 'us', location: 'Boston, MA', date_start: '2026-05-22', description: 'Harvard athletic complex.', lineup: ['Florence + The Machine'], tickets_url: 'https://bostoncalling.com', image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30' },
  { name: 'Shaky Knees 2026', region: 'us', location: 'Atlanta, GA', date_start: '2026-05-01', description: 'Indie rock in Atlanta.', lineup: ['The Strokes'], tickets_url: 'https://shakykneesfestival.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Life is Beautiful 2026', region: 'us', location: 'Las Vegas, NV', date_start: '2026-09-18', description: 'Art and urban music.', lineup: ['Lorde'], tickets_url: 'https://lifeisbeautiful.com', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Louder Than Life 2026', region: 'us', location: 'Louisville, KY', date_start: '2026-09-24', description: 'Heavy metal destination.', lineup: ['Pantera'], tickets_url: 'https://louderthanlifefestival.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Aftershock 2026', region: 'us', location: 'Sacramento, CA', date_start: '2026-10-09', description: 'Hard rock staple.', lineup: ['Slipknot'], tickets_url: 'https://aftershockfestival.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Hangout Festival 2026', region: 'us', location: 'Gulf Shores, AL', date_start: '2026-05-15', description: 'Beachside music.', lineup: ['Post Malone'], tickets_url: 'https://hangoutmusicfest.com', image_url: 'https://images.unsplash.com/photo-1470229722910-72e2d0673d3d' },
  { name: 'Inkcarceration 2026', region: 'us', location: 'Mansfield, OH', date_start: '2026-07-17', description: 'Metal and tattoos.', lineup: ['Korn'], tickets_url: 'https://inkcarceration.com', image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c24b064d' },
  { name: 'Forecastle 2026', region: 'us', location: 'Louisville, KY', date_start: '2026-05-29', description: 'Riverfront festival.', lineup: ['Jack Harlow'], tickets_url: 'https://forecastlefest.com', image_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629' },
  { name: 'BottleRock Napa 2026', region: 'us', location: 'Napa, CA', date_start: '2026-05-22', description: 'Wine and food festival.', lineup: ['P!nk'], tickets_url: 'https://bottlerocknapavalley.com', image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552' },
  { name: 'Newport Folk Festival 2026', region: 'us', location: 'Newport, RI', date_start: '2026-07-24', description: 'Historic folk gathering.', lineup: ['Brandi Carlile'], tickets_url: 'https://newportfolk.org', image_url: 'https://images.unsplash.com/photo-1594993877183-5154365518b2' },
  { name: 'Voodoo Experience 2026', region: 'us', location: 'New Orleans, LA', date_start: '2026-10-23', description: 'Halloween festival.', lineup: ['Guns N Roses'], tickets_url: 'https://voodoofestival.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Wonderfront 2026', region: 'us', location: 'San Diego, CA', date_start: '2026-11-20', description: 'Bayfront music.', lineup: ['Cage The Elephant'], tickets_url: 'https://wonderfrontfestival.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Sea.Hear.Now 2026', region: 'us', location: 'Asbury Park, NJ', date_start: '2026-09-18', description: 'Surf and sound.', lineup: ['Bruce Springsteen'], tickets_url: 'https://seahearnowfestival.com', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Day N Vegas 2026', region: 'us', location: 'Las Vegas, NV', date_start: '2026-09-02', description: 'Hip-hop and R&B.', lineup: ['J. Cole'], tickets_url: 'https://daynvegas2026.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Made in America 2026', region: 'us', location: 'Philadelphia, PA', date_start: '2026-09-05', description: 'Labor Day weekend.', lineup: ['Bad Bunny'], tickets_url: 'https://madeinamericafest.com', image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c24b064d' },
  { name: 'Roots Picnic 2026', region: 'us', location: 'Philadelphia, PA', date_start: '2026-06-03', description: 'Curated by The Roots.', lineup: ['The Roots'], tickets_url: 'https://rootspicnic.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Broccoli City 2026', region: 'us', location: 'Washington, DC', date_start: '2026-05-16', description: 'Black culture music.', lineup: ['Summer Walker'], tickets_url: 'https://bcfestival.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Hinterland 2026', region: 'us', location: 'Saint Charles, IA', date_start: '2026-08-07', description: 'Indie outdoor fest.', lineup: ['Hozier'], tickets_url: 'https://hinterlandiowa.com', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Levitation 2026', region: 'us', location: 'Austin, TX', date_start: '2026-10-29', description: 'Psych rock scene.', lineup: ['King Gizzard'], tickets_url: 'https://levitation-austin.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Kilby Block Party 2026', region: 'us', location: 'Salt Lake City, UT', date_start: '2026-05-15', description: 'Indie favorite.', lineup: ['Death Cab for Cutie'], tickets_url: 'https://kilbyblockparty.com', image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c24b064d' },
  { name: 'Treefort 2026', region: 'us', location: 'Boise, ID', date_start: '2026-03-25', description: 'Discovery festival.', lineup: ['Various'], tickets_url: 'https://treefortmusicfest.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Pickathon 2026', region: 'us', location: 'Happy Valley, OR', date_start: '2026-08-07', description: 'Sustainable indie.', lineup: ['Big Thief'], tickets_url: 'https://pickathon.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Under the Big Sky 2026', region: 'us', location: 'Whitefish, MT', date_start: '2026-07-17', description: 'Montana country.', lineup: ['Zach Bryan'], tickets_url: 'https://underthebigskyfest.com', image_url: 'https://images.unsplash.com/photo-1594993877183-5154365518b2' },
  { name: 'High Water 2026', region: 'us', location: 'North Charleston, SC', date_start: '2026-04-24', description: 'Shovels & Rope fest.', lineup: ['Bleachers'], tickets_url: 'https://highwaterfest.com', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Railbird 2026', region: 'us', location: 'Lexington, KY', date_start: '2026-06-05', description: 'Bourbon and music.', lineup: ['Tyler Childers'], tickets_url: 'https://railbirdfest.com', image_url: 'https://images.unsplash.com/photo-1594993877183-5154365518b2' },
  { name: 'Innings Festival 2026', region: 'us', location: 'Tempe, AZ', date_start: '2026-02-27', description: 'Baseball and music.', lineup: ['Green Day'], tickets_url: 'https://inningsfestival.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Tortuga 2026', region: 'us', location: 'Fort Lauderdale, FL', date_start: '2026-04-10', description: 'Ocean conservation.', lineup: ['Kenny Chesney'], tickets_url: 'https://tortugamusicfestival.com', image_url: 'https://images.unsplash.com/photo-1470229722910-72e2d0673d3d' },
  { name: 'Moonrise 2026', region: 'us', location: 'Baltimore, MD', date_start: '2026-08-07', description: 'EDC Mid-Atlantic.', lineup: ['Skrillex'], tickets_url: 'https://moonrisefestival.com', image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { name: 'Ubbi Dubbi 2026', region: 'us', location: 'Fort Worth, TX', date_start: '2026-04-24', description: 'Texas electronic fest.', lineup: ['Excision'], tickets_url: 'https://ubbidubbi.com', image_url: 'https://images.unsplash.com/photo-1516280440614-6297241c7310' },
  { name: 'Breakaway 2026', region: 'us', location: 'Columbus, OH', date_start: '2026-08-28', description: 'Multi-city EDM.', lineup: ['Illenium'], tickets_url: 'https://breakawayfestival.com', image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c24b064d' },
  { name: 'Wonderbus 2026', region: 'us', location: 'Columbus, OH', date_start: '2026-08-21', description: 'City music fest.', lineup: ['The Lumineers'], tickets_url: 'https://wonderbusfest.com', image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063' },
  { name: 'Bourbon & Beyond 2026', region: 'us', location: 'Louisville, KY', date_start: '2026-09-17', description: 'Culinary and music.', lineup: ['Dave Matthews Band'], tickets_url: 'https://bourbonandbeyond.com', image_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629' }
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