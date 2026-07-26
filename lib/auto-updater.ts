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
 "The Rolling Stones - In The Stars",
"Bring Me the Horizon - Dehumanized - 2026 Repented",
"beabadoobee - Sun Has Set",
"Bring Me the Horizon - Black & Blue (2026 Repented)",
"Christopher Saint - Ulterior Motives (1985 AOP Mix)",
"The Rolling Stones - Jealous Lover",
"The Last Dinner Party - Big Dog",
"PRESIDENT - Angel Wings",
"PRESIDENT - Mercy",
"Loathe - Fangs",
"The Rolling Stones - Rough And Twisted",
"Bring Me the Horizon - Pray for Plagues (2026 Repented)",
"Paul McCartney - Come Inside",
"David Suntory - Still Loving You",
"Paul McCartney - As You Lie There",
"The Rolling Stones - Intervenção Divina",
"Paul McCartney • Ringo Starr - Home to Us",
"Bring Me the Horizon - (I Used to Make Out With) Medus...",
"Bring Me the Horizon - Tell Slater Not to Wash His Dick (2...",
"Paul McCartney - Days We Left Behind",
"Overgrown - Give Up",
"loveshy - Spineless",
"Bring Me the Horizon - For Stevie Wonder's Eyes Only (B...",
"South Arcade - SUPERMAN",
"Don Broco • Sam Carter - True Believers (Feat. Sam Carter)",
"Paul McCartney - Ripples in a Pond",
"Waitress - Here Come The Cats",
"Pink Floyd - Pigs on the Wing - 8-Track Version",
"Bring Me the Horizon - A Lot Like Vegas (2026 Repented)",
"Yungblud - Suburban Requiem",
"Paul McCartney - Lost Horizon",
"loveshy - Blackout",
"Bring Me the Horizon - Dragon Slaying (2026 Repented)",
"Overgrown - Blind",
"Paul McCartney - Down South",
"Paul McCartney - We Two",
"Paul McCartney - Mountain Top",
"Loathe - Revenant",
"DEADCUE - Aint't No Savin' Me",
"Bank Holiday - Out of the Blue",
"Power Glove - Shall Never Surrender",
"Jamie Bower - Waiting for Your Love",
"Bring Me the Horizon - Off the Heezay (2026 Repented)",
"Bring Me the Horizon - Slow Dance (2026 Repented)",
"Paul McCartney - Life Can Be Hard",
"VOILÀ • Austin Giorgio - Spotlight",
"Holding Absence - Whisper of a Dream",
"Don Broco • Nickelback - Nightmare Tripping (Feat. Nickelb...",
"Paul McCartney - Never Know",
"Holding Absence - Reflection"


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
          region: 'UK',
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

  } catch (err: any) {
    console.error('Kritična greška:', err.message || err);
  }
}