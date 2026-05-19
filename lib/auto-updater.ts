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

    // Ovde unesi pesme koje želiš na sajtu (ovo menjaš po želji)
   
   
  const mojePesme = [
  
"Muse - Cryogen",
"Tigercub - A Black Moon",
"FEDZ - H.R. FUKNSTUF",
"DON BROCO, Sam Carter - True Believers (Feat. Sam Carter)",
"Enter Shikari - LOSE YOUR SELF",
"GRAYWOLF - Shattered Horizons",
"YONAKA - Eat You Alive",
"Muse - Unravelling",
"Lucyvivor - Exile Symphony",
"DEAD SUGAR - KENOPSIA",
"Lost In Details - Memory Of Mine",
"Biffy Clyro - True Believer",
"Tokeo - Flava",
"Coach Party - Nurse Depression",
"Trash Boat - Rain",
"Lucyvivor - Milk and Venom",
"Chalk - Tongue",
"YONAKA - Hit Me When I'm Sore",
"Tigercub - Fall In Fall Out",
"MOULD, Perfect Binding - Lists",
"WAIL - NIGHTS",
"Secret Cameras - Together Till The End",
"n0trixx - hysteria [БЕГП]",
"Kid Kapichi - Dark Days Are Coming",
"nineplanfailed - house",
"Love Is Noise - Everyone Bleeds",
"PRESIDENT - Dionysus",
"n0trixx, Sarunas Brazionis - harmless",
"GRAYWOLF - Scream",
"YONAKA - Cruel",
"Tigercub - I'm Breaking Out",
"Lucyvivor, n0trixx - Serpent Script",
"Witch Fever - I SEE IT",
"WAIL - FEEL A CHANGE",
"Sleep Token - Gethsemane",
"Bring Me The Horizon - Wonderwall - Spotify Singles",
"Reflection Black - Shadow Self",
"Lucyvivor - Eden",
"PRESIDENT - Destroy Me",
"Hot Milk - Swallow This",
"WARGASM (UK) - Vigilantes",
"Black Sabbath - Iron Man - 2009 Remaster",
"DEADLETTER - It Comes Creeping",
"GRAYWOLF - We'll Bring You Down - Live At The Creek",
"Bring Me The Horizon - Kool-Aid",
"Marta Vega - Bruised",
"Inhaler - Hole In The Ground",
"Secret Cameras - Back Against The Wall",
"And it was Night - What's Beyond the Light?",
"RUT! - DAWN",
"Secret Cameras - Under Attack",
"Lessens - Holding Room",
"Coach Party - Girls!",
"RUT! - Fake Lights",
"BathTub - MARRY ME?",
"RUT! - I HATE U",
"Secret Cameras - You Couldn't See Me",
"Kid Kapichi - Rabbit Hole",
];

    for (const query of mojePesme) {
      console.log(`Tražim: ${query}...`);

      const ytRes = await youtube.search.list({
        part: ['id', 'snippet'],
        q: query + " official video",
        maxResults: 1,
        type: ['video'],
      });

      const item = ytRes.data.items?.[0];
      const videoId = item?.id?.videoId;
      const thumb = item?.snippet?.thumbnails?.high?.url;
      const titleParts = query.split(" - ");

      const { error } = await supabase
        .from('songs')
        .upsert({
          title: titleParts[1] || query,
          artist_name: titleParts[0] || "Unknown",
          slika_url: thumb || '',
          youtube_id: videoId || '',
          region: 'UK',       // <--- DODAJ REGION
          genre_id: 1 ,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
          year: 2026,         // <--- DODAJ GODINU
          is_chart: true      // <--- DA BUDE AKTIVNA
        }, { onConflict: 'title' });

      if (error) {
        console.error(`❌ Greška za ${query}:`, error.message);
      } else {
        console.log(`✅ Uspešno ubačeno: ${query}`);
      }
    }

    console.log("--- KRAJ ---");

  } catch (err: any) {
    console.error('Kritična greška:', err.message || err);
  }
}