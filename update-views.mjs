import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function updateAllViews() {
  try {
    console.log("--- START AUTOMATSKOG OSVEŽAVANJA ZA SVE PESME ---");

    let allSongs = [];
    let hasMore = true;
    let page = 0;
    const PAGE_SIZE = 1000;

    // 1. PAMETNO POVLAČENJE: Vučemo pesme u krugovima od po 1000 sve dok ne pokupimo SVE pesme iz baze
    while (hasMore) {
      console.log(`Preuzimam pesme iz baze (krug ${page + 1})...`);
      
      const { data: songs, error: dbError } = await supabase
        .from('songs')
        .select('id, youtube_id, title')
        .not('youtube_id', 'eq', '') // Preskačemo ako nema YouTube ID
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1); // Paginacija (0-999, 1000-1999...)

      if (dbError) throw dbError;

      if (!songs || songs.length === 0) {
        hasMore = false;
      } else {
        allSongs = allSongs.concat(songs);
        if (songs.length < PAGE_SIZE) {
          hasMore = false; // Ako je vratilo manje od 1000, znači da nema više pesama u bazi
        } else {
          page++;
        }
      }
    }

    console.log(`Ukupno pronađeno ${allSongs.length} pesama sa YouTube ID-jem za ažuriranje.`);

    // 2. Prolazimo kroz SVAKU pesmu sa liste (bilo ih 1000 ili 2000+)
    for (const song of allSongs) {
      try {
        const ytRes = await youtube.videos.list({
          part: ['statistics'],
          id: [song.youtube_id],
        });

        const videoStats = ytRes.data.items?.[0]?.statistics;
        if (!videoStats) {
          console.log(`⚠️ Statistika nije pronađena za video (moguće da je obrisan): ${song.title}`);
          continue;
        }

        const currentViews = parseInt(videoStats.viewCount || '0', 10);

        // 3. Upisujemo broj pregleda u kolonu 'viewers'
        const { error: updateError } = await supabase
          .from('songs')
          .update({ viewers: currentViews })
          .eq('id', song.id);

        if (updateError) {
          console.error(`❌ Greška pri upisu za ${song.title}:`, updateError.message);
        } else {
          console.log(`✅ ${song.title} -> ${currentViews} pregleda.`);
        }
      } catch (ytErr) {
        console.error(`❌ YouTube greška za pesmu ${song.title} (ID: ${song.youtube_id}):`, ytErr.message || ytErr);
      }
    }

    console.log("--- KRAJ OSVEŽAVANJA SVIH PESMA ---");

  } catch (err) {
    console.error('Kritična greška u skripti:', err.message || err);
  }
}

updateAllViews();
