import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function updateMusicCharts() {
  try {
    console.log("--- START RUČNOG AŽURIRANJA ---");

    const mojePesme = 




[
"Tame Impala, Jennie - Dracula - JENNIE Remix",
"BTS - SWIM",
"iLLIT - It's Me",
"CORTIS - REDRED",
"aespa - LEMONADE",
"BTS - 2.0",
"Stray Kids - RUN IT",
"BTS - Come Over",
"BTS - Hooligan",
"BTS - Body to Body",
"YEONJUN - Ice Cream",
"BTS - they don’t know ‘bout us",
"BTS - FYA",
"BABYMONSTER - SUGAR HONEY ICE TEA",
"BTS - Into the Sun",
"BTS - Like Animals",
"BTS - Please",
"BTS - Aliens",
"LE SSERAFIM - BOOMPALA",
"BTS - One More Night",
"BTS - Merry Go Round",
"Hearts2Hearts - RUDE!",
"BTS - NORMAL",
"Hearts2Hearts - Lemon Tang",
"Andrea Bocelli, David Guetta - DNA (More Than A Game)",
"BABYMONSTER - CHOOM",
"iLLIT, LE SSERAFIM, KATSEYE - ICONIC BY MISTAKE",
"BTS - No. 29",
"ATEEZ - BAD",
"evan - Ride or Die",
"TOMORROW X TOGETHER - Stick With You",
"CORTIS - ACAI",
"CORTIS - TNT",
"LE SSERAFIM - CELEBRATION",
"G-Dragon, aespa - WDA (Whole Different Animal)",
"CORTIS - YOUNGCREATORCREW",
"BLACKPINK - GO",
"Boynextdoor - VIRAL",
"Treasure - IF I",
"IVE - BANG BANG",
"BABYMONSTER - I LIKE IT",
"NMIXX - Heavy Serenade",
"RIIZE - Do your dance",
"I.O.I - Suddenly",
"evan - Overflow",
"CORTIS - Blue Lips",
"CORTIS - Wassup",
"ATEEZ - Adrenaline",
"Kiss of Life - Who is she",

    ];

    for (const [index, query] of mojePesme.entries()) {
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
      } catch (ytErr: any) {
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
          region: 'ASIA',
          genre_id: 9, // C-Pop
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

  } catch (err: any) {
    console.error('Kritična greška:', err.message || err);
  }
}