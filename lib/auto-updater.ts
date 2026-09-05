import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export interface RegionConfig {
  regionName: string;
  countryCodes: string[];
}

export const TARGET_REGIONS: RegionConfig[] = [
  { regionName: 'US', countryCodes: ['US'] },
  { regionName: 'UK', countryCodes: ['GB'] },
  {
    regionName: 'LATINO',
    countryCodes: ['MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'DO', 'PR', 'CR', 'PA', 'UY', 'PY', 'BO', 'ES', 'PT'],
  },
  { regionName: 'GERMANY', countryCodes: ['DE'] },
  { regionName: 'FRANCE', countryCodes: ['FR'] },
  { regionName: 'ITALY', countryCodes: ['IT'] },
  { regionName: 'POLAND', countryCodes: ['PL'] },
  { regionName: 'NORDIC', countryCodes: ['SE', 'NO', 'DK', 'FI', 'IS'] },
  { regionName: 'BALTIC', countryCodes: ['EE', 'LV', 'LT'] },
  { regionName: 'BALKAN', countryCodes: ['RS', 'BA', 'BG', 'RO', 'GR', 'AL', 'HR', 'MK', 'ME', 'XK', 'SI'] },
  { regionName: 'OTHER', countryCodes: ['AT', 'BE', 'CH', 'CY', 'CZ', 'HU', 'IE', 'LU', 'MT', 'NL', 'SK'] },
  { regionName: 'ASIA', countryCodes: ['JP', 'KR', 'CN', 'IN', 'TW', 'TH', 'PH', 'ID', 'VN'] },
  { regionName: 'WORLD', countryCodes: [] },
];

export const REGION_COUNTRY_MAP: Record<string, string[]> = Object.fromEntries(
  TARGET_REGIONS.map(({ regionName, countryCodes }) => [regionName, countryCodes]),
);

export interface SCGenreMapping {
  dbGenreId: number;
  countryOverride?: string[];
}

export const SOUNDCHARTS_TO_DB_GENRE: Record<string, SCGenreMapping> = {
  rock: { dbGenreId: 1 },
  alternative: { dbGenreId: 1 },
  blues: { dbGenreId: 1 },
  ska: { dbGenreId: 1 },
  pop: { dbGenreId: 2 },
  disco: { dbGenreId: 2 },
  latin: { dbGenreId: 2 },
  'hip-hop': { dbGenreId: 3 },
  'r-b': { dbGenreId: 4 },
  'rb-soul': { dbGenreId: 4 },
  soul: { dbGenreId: 4 },
  funk: { dbGenreId: 4 },
  reggae: { dbGenreId: 4 },
  country: { dbGenreId: 5 },
  folk: { dbGenreId: 5 },
  edm: { dbGenreId: 6 },
  electro: { dbGenreId: 6 },
  'dance-electronic': { dbGenreId: 6 },
  'j-pop': { dbGenreId: 7, countryOverride: ['JP'] },
  'j-rock-metal': { dbGenreId: 8, countryOverride: ['JP'] },
  'k-pop': { dbGenreId: 9, countryOverride: ['KR'] },
  'c-pop': { dbGenreId: 10, countryOverride: ['CN', 'TW'] },
  'indian-pop': { dbGenreId: 11, countryOverride: ['IN'] },
  india: { dbGenreId: 11, countryOverride: ['IN'] },
  jazz: { dbGenreId: 13 },
  classical: { dbGenreId: 14 },
  metal: { dbGenreId: 15 },
  other: { dbGenreId: 12 },
};

export function buildSoundchartsFilter(countryCodes: string[], genreSlug: string, now = new Date()): string {
  const todayFormatted = now.toISOString().slice(0, 10);
  const startDate = `${now.getUTCFullYear() - 1}-12-22`;
  const filterPayload: {
    s: string;
    f: { ftsg: string; frd: string; fc?: string };
    mi: Array<[string, { mm: string }]>;
  } = {
    s: 'custom.sc_trending_score|desc|month|total',
    f: {
      ftsg: genreSlug,
      frd: `${startDate}|${todayFormatted}`,
    },
    mi: [['audience.spotify.total', { mm: '' }]],
  };

  if (countryCodes.length > 0) filterPayload.f.fc = countryCodes.join(',');
  return Buffer.from(JSON.stringify(filterPayload)).toString('base64');
}

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createClient(url, key);
}

export async function updateMusicCharts() {
  try {
    const supabase = getSupabase();
    console.log("--- START RUČNOG AŽURIRANJA ---");

    const mojePesme = 



[
"Creedence Clearwater Revival - Midnight Special",
"Motionless in White - Afraid Of The Dark",
"Starset - WE ARE EMPIRE",
"mgk, Fred Durst - FIX UR FACE (with Fred Durst)",
"Morgan Luna - You Lost Me Forever",
"Bruce Springsteen - Streets of Minneapolis",
"The Stringini Bros - The Human Shields",
"Drowning Pool, Rob Zombie - The Man Without Fear",
"Motionless in White, Corey Taylor - Playing God (feat. Corey Taylor)",
"The Doors - Hello, I Love You (LP Version)",
"Moon Walker - YOU'RE NEXT",
"Creedence Clearwater Revival - Sweet Hitch-hiker",
"Megadeth - Ride The Lightning (Bonus Track)",
"Social Distortion - Born To Kill",
"Electric Callboy, The Offspring - Track #4",
"Sevendust - Is This The Real You",
"Morgan Luna - You Are My Heaven",
"Saosin - Starting Over Again",
"Bug Hunter - Bottle Rocket Astronaut",
"Megadeth - Let There Be Shred",
"Steve Vai, Joe Satriani - Dancing",
"Marilyn Manson - Unalive",
"Atreyu - All For You",
"Noah Graves - Jesus, I'm afraid",
"Megadeth - Puppet Parade",
"Anatolian Rock Echoes - Ötelerden Bir Ses Geldi",
"Moon Walker - PARADE",
"A Perfect Circle - Starless",
"The All-American Rejects - King Kong",
"Sevendust - Unbreakable",
"Wage War - SONG OF THE SWAMP",
"Megadeth - Hey God?!",
"Godsmack - Battle Of The Drums (Live at Mohegan Sun)",
"Ministry of Dark - Dead Man Dancing",
"From Ashes to New - Forever",
"Nightshade Anthem - Drowning In Yourself",
"From Ashes to New - Die For You",
"CharFutur - I Guess I’m In Love (Original Version)",
"Megadeth - The Last Note",
"A Day to Remember, Bilmuri - ALWAYS LET YOU DOWN",
"Lamb of God - Into Oblivion",
"Megadeth - Another Bad Day",
"Sleep Theory - Bye Bye Bye",
"Evanescence - Beautiful Lie",
"Drew Jacobs, Caitlynne Curtis - What Hurts The Most",
"Papa Roach, Power Glove - Getting Away with Murder (Power Glove Remix)",
"American High Digital, Luke Burke - Polyamorous",
"Morgan Luna - Infinite Love",
"Hollywood Undead, Jeris Johnson - All My Friends",
"Saliva, Judge & Jury - Edge of a Knife",



    ];

    for (const query of mojePesme) {
      console.log(`Tražim: ${query}...`);

      let videoId = '';
      let thumb = '';

      try {
        const ytRes = await youtube.search.list({
          part: ['id', 'snippet'],
          q: query + " official video",
          maxResults: 1,
          type: ['video'],
        });

        const item = ytRes.data.items?.[0];
        videoId = item?.id?.videoId || '';
        thumb = item?.snippet?.thumbnails?.high?.url || '';
      } catch {
        console.warn(`⚠️ YouTube API nedostupan/kvota prekoracena.`);
      }

      // Ako je YouTube zakazao, pravimo privremeni ID da baza ne odbije unos
     if (!videoId) {
  console.log(`⏭️ Preskačem "${query}" jer nema validan YouTube ID (kvota istekla).`);
  continue; // Skaci na sledecu pesmu
}

      const titleParts = query.split(" - ");

      const { error } = await supabase
        .from('songs')
        .upsert({
          title: titleParts[1] || query,
          artist_name: titleParts[0] || "Unknown",
          slika_url: thumb,
          youtube_id: videoId, // Sigurno nije prazno!
          region: 'US',
          genre_id: 1, // C-Pop
          year: 2026,
          is_chart: true
        }, { 
          onConflict: 'title,artist_name,region,genre_id' 
        });

      if (error) {
        console.error(`❌ Greška za ${query}:`, error.message);
      } else {
        console.log(`✅ Uspešno ubačeno: ${query} (ID: ${videoId})`);
      }
    }

    console.log("--- KRAJ ---");

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Kritična greška:', message);
  }
}

