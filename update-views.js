import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

async function syncYoutubeViews() {
  try {
    // 1. Povuci sve pesme iz baze
    const { data: songs, error } = await supabase
      .from('songs') 
      .select('id, youtube_id');

    if (error || !songs) throw new Error("Greška pri povlačenju iz Supabase: " + error?.message);

    // 2. Spakuj YouTube ID-eve u jedan string za Google API
    const videoIds = songs.map(s => s.youtube_id).filter(Boolean).join(',');
    
    // 3. Pitaj YouTube za trenutni broj pregleda
    const ytResponse = await youtube.videos.list({ part: ['statistics'], id: [videoIds] });

    const viewsMap = {};
    ytResponse.data.items?.forEach(item => {
      viewsMap[item.id] = parseInt(item.statistics?.viewCount || '0', 10);
    });

    // 4. Prođi kroz svaku pesmu i ažuriraj 'viewers' kolonu
    for (const song of songs) {
      const freshViews = viewsMap[song.youtube_id];
      if (freshViews !== undefined) {
        await supabase
          .from('songs')
          .update({ viewers: freshViews })
          .eq('id', song.id);
      }
    }
    console.log("🚀 Uspešno osvežen broj pregleda za sve pesme!");
  } catch (err) {
    console.error("❌ Greška tokom sinhronizacije:", err);
  }
}

syncYoutubeViews();
