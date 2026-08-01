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
"Dexter and The Moonrocks - Freakin' Out",
"Treaty Oak Revival - 12 Steps (feat. Treaty Oak Revival)",
"Mr. Polska, Ski Aggu - Spring",
"Brawl Stars, Electric Callboy - Hypercharged",
"Die Toten Hosen - Nur nach vorn",
"RavenstrikeX - Pain Is Loud",
"Echoes Of Asgard - Nothing Else Matters",
"Die Toten Hosen - Die Show muss weitergehen",
"Giant Rooks, Solann - The Waves (feat. Solann)",
"Chilx, Rubikdice, Aaron Kos - MONTAGEM PEGADORA - ROCK ...",
"Echoes Of Asgard - Bring Me To Life",
"ReinaRi - Lion",
"Die Toten Hosen - Was früher einmal war",
"Die Toten Hosen - Wir waren nie weg",
"Dexter and The Moonrocks - Freakin' Out (Oops All Drop)",
"GPF, Sickmode, Dr Donk - KISS KISS",
"Die Toten Hosen, Farin Urlaub - Intro",
"Echoes Of Asgard - Diamonds",
"Dexter and The Moonrocks - If You Could Talk",
"Giant Rooks - Want It Back",
"Dexter and The Moonrocks - Flavorless",
"Die Toten Hosen - Schlechte Nachbarn",
"Die Toten Hosen - Was ist mit uns los",
"Saint Vice - LOSE CONTROL",
"nestybeats - Make it rock",
"Echoes Of Asgard - Zombie",
"Saint Vice - ALTAR - Sped Up",
"Die Toten Hosen - Schicksal",
"Die Toten Hosen - Lass mal nicht machen",
"Saint Vice - ALTAR",
"Iron West - Madman’s Lullaby",
"Simon Will, Noel Dederichs - Hitzefrei",
"Die Toten Hosen - Düsseldorf",
"Saint Vice - DROWNING",
"Die Toten Hosen - Trink aus",
"Die Toten Hosen - Keine Macht den Proben",
"Lemony Licht in mir - Eure Meinung",
"Iron West, noluv - THE DEVIL STEPS BACK",
"Dexter and The Moonrocks - Wet",
"Dexter and The Moonrocks - West Of Where I Am",
"Iron West - DEVIL KNOWS MY NAME",
"Die Toten Hosen - Track 2-3",
"Die Toten Hosen - Augen zu (Es regnet Blumen)",
"Jennifer Rostock - Wir schon wieder",
"Vintash - Unter der Sonne",
"SNOWBYTE - Which Version of Me",
"СДП - Сыпь, гармоника!",
"Marteria, Die Toten Hosen - Track 2-5",
"Die Toten Hosen - Glück",
"Saint Vice - BODY LOCKED TO MINE",

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
          region: 'GERMANY',
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