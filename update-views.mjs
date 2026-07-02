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
    console.log("--- START AUTOMATSKOG ČIŠĆENJA I OSVEŽAVANJA ---");

    let allSongs = [];
    let hasMore = true;
    let page = 0;
    const PAGE_SIZE = 1000;

    // 1. Povlačimo pesme iz baze u krugovima
    while (hasMore) {
      const { data: songs, error: dbError } = await supabase
        .from('songs')
        .select('id, youtube_id, title')
        .not('youtube_id', 'eq', '')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dbError) throw dbError;

      if (!songs || songs.length === 0) {
        hasMore = false;
      } else {
        allSongs = allSongs.concat(songs);
        if (songs.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`Ukupno procesuiram ${allSongs.length} pesama...`);

    // 2. Proveravamo svaku pesmu preko YouTube API-ja
    for (const song of allSongs) {
      try {
        // Tražimo statistiku (preglede) ali i snippet (gde se nalazi datum objave)
        const ytRes = await youtube.videos.list({
          part: ['statistics', 'snippet'],
          id: [song.youtube_id],
        });

        const videoData = ytRes.data.items?.[0];
        
        if (!videoData) {
          console.log(`⚠️ Video ne postoji (obrisan sa YT). Brišem iz baze: ${song.title}`);
          await supabase.from('songs').delete().eq('id', song.id);
          continue;
        }

        const publishedAt = videoData.snippet?.publishedAt; // Format: "2024-04-17T15:00:00Z"
        const releaseYear = new Date(publishedAt).getFullYear();

        // ❌ FILTER: Ako pesma NIJE iz 2026. godine, brišemo je odmah iz baze!
        if (releaseYear !== 2026) {
          console.log(`🗑️ Izbacujem (starija pesma - ${releaseYear}): ${song.title}`);
          await supabase.from('songs').delete().eq('id', song.id);
          continue;
        }

        // 🚀 AKO JE 2026: Računamo odnos premijere i pregleda
        const currentViews = parseInt(videoData.statistics?.viewCount || '0', 10);
        
        const releaseDate = new Date(publishedAt);
        const today = new Date();
        
        // Računamo razliku u danima (minimum 1 dan da ne delimo sa nulom)
        const diffTime = Math.abs(today - releaseDate);
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))); 

        // Poeni = ukupni pregledi podeljeni sa brojem dana od premijere
        const viewsPerDay = Math.round(currentViews / diffDays);

        // Ažuriramo kolone u bazi (upisujemo i tačan datum u tvoju praznu kolonu!)
        const { error: updateError } = await supabase
          .from('songs')
          .update({ 
            viewers: viewsPerDay, // 👈 Sajt sortira po ovome (sada su to poeni/dnevni prosek)
            release_date: publishedAt.split('T')[0] // 👈 Automatski punimo praznu kolonu tačnim datumom!
          })
          .eq('id', song.id);

        if (updateError) {
          console.error(`❌ Greška pri upisu za ${song.title}:`, updateError.message);
        } else {
          console.log(`✅ ${song.title} -> ${viewsPerDay} poena/dan (Ukupno: ${currentViews}, Dani: ${diffDays})`);
        }

      } catch (ytErr) {
        console.error(`❌ Greška za pesmu ${song.title}:`, ytErr.message || ytErr);
      }
    }

    console.log("--- ČIŠĆENJE I OSVEŽAVANJE ZAVRŠENO ---");

  } catch (err) {
    console.error('Kritična greška:', err.message || err);
  }
}

updateAllViews();
