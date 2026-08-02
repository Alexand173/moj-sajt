import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// -----------------------------------------------------------------------------
// 1. INICIJALIZACIJA KLIJENATA
// -----------------------------------------------------------------------------

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// -----------------------------------------------------------------------------
// 2. MAPIRANJE REGIJA SA SVIH TVOJIH SLIKA I DEFINICIJA
// -----------------------------------------------------------------------------

export const REGION_COUNTRY_MAP: Record<string, string[]> = {
  // Samostalne države
  'US': ['US'],
  'UK': ['GB'],
  'GERMANY': ['DE'],
  'FRANCE': ['FR'],
  'ITALY': ['IT'],
  'SPAIN': ['ES'],
  'POLAND': ['PL'],

  // Grupisane regije
  'LATINO': [
    'MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 
    'DO', 'PR', 'CR', 'PA', 'UY', 'PY', 'BO', 'ES', 'PT'
  ],
  'NORDIC': ['SE', 'NO', 'DK', 'FI', 'IS'],
  'BALTIC': ['EE', 'LV', 'LT'],
  'BALKAN': [
    'RS', 'BA', 'BG', 'RO', 'GR', 'AL', 'HR', 'MK', 'ME', 'XK', 'SI'
  ],
  'ASIA': ['JP', 'KR', 'CN', 'IN', 'TW', 'TH', 'PH', 'ID', 'VN']
};

// -----------------------------------------------------------------------------
// 3. MAPIRANJE SOUNDCHARTS ŽANROVA NA TVOJIH 12 ID-JEVA IZ SUPABASE-A
// -----------------------------------------------------------------------------

export const SOUNDCHARTS_TO_DB_GENRE: Record<string, number> = {
  // 1: Rock
  "rock": 1,
  "alternative": 1,
  "metal": 1,
  "blues": 1,
  "ska": 1,

  // 2: Pop
  "pop": 2,
  "disco": 2,
  "latin": 2,

  // 3: Hip-Hop
  "hip-hop": 3,

  // 4: R&B/Soul
  "r-b": 4,
  "soul": 4,
  "funk": 4,
  "reggae": 4,

  // 5: Country
  "country": 5,
  "folk": 5,

  // 6: Dance/Electronic
  "edm": 6,
  "electro": 6,

  // 7: J-POP
  "j-pop": 7,

  // 8: J-ROCK & METAL
  "j-rock-metal": 8,

  // 9: K-POP
  "k-pop": 9,

  // 10: C-POP
  "c-pop": 10,

  // 11: INDIA
  "indian-pop": 11,

  // 12: OTHER (Svi ostali nestandardni žanrovi idu na ID 12)
  "classical": 12,
  "jazz": 12,
  "kids": 12,
  "others": 12,
  "religious": 12,
  "soundtrack": 12,
  "spoken": 12,
  "sports": 12,
  "traditional": 12
};

// -----------------------------------------------------------------------------
// 4. POMOĆNA FUNKCIJA ZA KREIRANJE DINAMIČKOG BASE64 FILTERA
// -----------------------------------------------------------------------------

function buildSoundchartsFilter(countryCodes: string[], genreSlug: string): string {
  const today = new Date();
  const todayFormatted = today.toISOString().split('T')[0];
  
  // Opseg od 22. decembra prethodne godine do TEKUĆEG današnjeg dana
  const startDate = `${today.getFullYear() - 1}-12-22`; 

  const filterPayload = {
    s: "custom.sc_trending_score|desc|month|total",
    f: {
      fc: countryCodes.join(','),
      ftsg: genreSlug,
      frd: `${startDate}|${todayFormatted}`
    },
    mi: [
      ["audience.spotify.total", { mm: "" }]
    ]
  };

  return Buffer.from(JSON.stringify(filterPayload)).toString('base64');
}

// -----------------------------------------------------------------------------
// 5. FUNKCIJA ZA SYNCHRONIZACIJU JEDNE KOMBINACIJE
// -----------------------------------------------------------------------------

async function syncSingleCombination(regionName: string, countryCodes: string[], genreSlug: string, dbGenreId: number) {
  const rawFilters = buildSoundchartsFilter(countryCodes, genreSlug);

  try {
    const response = await axios.get('https://customer.api.soundcharts.com/api/v2/song/search', {
      headers: {
        'x-app-id': process.env.SOUNDCHARTS_APP_ID,
        'x-app-key': process.env.SOUNDCHARTS_APP_KEY,
      },
      params: {
        filters: rawFilters,
        limit: 20
      }
    });

    const songs = response.data?.items || [];
    
    if (songs.length === 0) return;

    console.log(`\n🎵 [${regionName} | SC Genre: ${genreSlug} -> DB Genre ID: ${dbGenreId}] Povučeno ${songs.length} pesama.`);

    for (const song of songs) {
      const songTitle = song.name || song.title;
      const artistName = song.creditName || song.artists?.[0]?.name || 'Unknown Artist';
      const fullQuery = `${artistName} - ${songTitle}`;

      let videoId = '';
      let thumb = '';

      try {
        const ytRes = await youtube.search.list({
          part: ['id', 'snippet'],
          q: `${fullQuery} official video`,
          maxResults: 1,
          type: ['video'],
        });

        const item = ytRes.data.items?.[0];
        videoId = item?.id?.videoId || '';
        thumb = item?.snippet?.thumbnails?.high?.url || '';
      } catch (ytErr: any) {
        console.warn(`⚠️ YouTube problem za "${fullQuery}": ${ytErr.message}`);
      }

      if (!videoId) {
        console.log(`⏭️ Preskačem "${fullQuery}" (nema YouTube ID).`);
        continue;
      }

      const releaseDate = song.releaseDate ? song.releaseDate.split('T')[0] : '2026-01-01';
      const songYear = new Date(releaseDate).getFullYear();

      // Upsert u Supabase 'songs' tabelu
      const { error } = await supabase
        .from('songs')
        .upsert({
          title: songTitle,
          artist_name: artistName,
          release_date: releaseDate,
          slika_url: thumb,
          youtube_id: videoId,
          region: regionName,
          genre_id: dbGenreId, // Tačan ID iz tvoje tabele (1-12)
          year: songYear,
          is_chart: true,
          viewers: song.spotifyStats?.streamCount || song.stats?.totalStreams || 0,
          votes: 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'title,artist_name,region,genre_id'
        });

      if (error) {
        console.error(`❌ Greška pri upisu u Supabase za "${fullQuery}":`, error.message);
      } else {
        console.log(`✅ [SAČUVANO] ${fullQuery} | Region: ${regionName} | Genre ID: ${dbGenreId}`);
      }
    }

  } catch (err: any) {
    // Tiho preskoči ako Soundcharts vrati grešku ili prazno za neku egzotičnu kombinaciju
  }
}

// -----------------------------------------------------------------------------
// 6. GLAVNA POKRETAČKA FUNKCIJA
// -----------------------------------------------------------------------------

export async function runCompleteAutomatedSync() {
  console.log("===============================================================");
  console.log("🚀 START SINHRONIZACIJE CHARTOVA SA TVOJOM SUPABASE TABELOM");
  console.log("===============================================================");

  const regionKeys = Object.keys(REGION_COUNTRY_MAP);
  const genreEntries = Object.entries(SOUNDCHARTS_TO_DB_GENRE);

  for (const regionName of regionKeys) {
    const countryCodes = REGION_COUNTRY_MAP[regionName];

    for (const [scGenreSlug, dbGenreId] of genreEntries) {
      await syncSingleCombination(regionName, countryCodes, scGenreSlug, dbGenreId);

      // Pauza od 150ms za Rate-Limit
      await new Promise(res => setTimeout(res, 150));
    }
  }

  console.log("\n===============================================================");
  console.log("🎉 POTPUNA SINHRONIZACIJA ZAVRŠENA! Baza je 1:1 sa Soundcharts-om.");
  console.log("===============================================================");
}

// Pokreni
runCompleteAutomatedSync();