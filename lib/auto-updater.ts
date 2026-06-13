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
  

"Alabama Shakes - American Dream",
  "Wednesday - Elderberry Wine",
  "Caamp - Mistakes",
  "David Byrne - Everybody Laughs",
  "Geese - Taxes",
  "Lucy Dacus - Planting Tomatoes",
  "Christina Crofts - See You Stumble",
  "Thee Sacred Souls - Any Old Fool",
  "Robert Plant - Everybody's Song",
  "Momma - I Want You (Fever)",
  "Wolf Alice - Bloom Baby Bloom",
  "Jay Som - Float (feat. Jim Adkins)",
  "Florence + the Machine - Everybody Scream",
  "Spoon - Guess I'm Fallin in Love",
  "NxWorries - Everybody Gets Down",
  "Lala Lala - Even Mountains Erode",
  "Tyler Ballgame - Matter of Taste",
  "The Strokes - Going Shopping",
  "Shearwater - Daydream Unbeliever",
  "Valice - Drive on",
  "Ratboys - Anywhere",
  "RAYE - Nightingale Lane.",
  "Iron & Wine - In Your Ocean",
  "Adrian Quesada - MF AF",
  "Almost Heaven - Fever Trying to Blow",
  "Jalen Ngonda - Doctrine of Love",
  "Mount Kimbie - Home Recording",
  "Spoon - Chateau Blues",
  "Hudson Freeman - If You Know Me",
  "My Morning Jacket - Time Waited",
  "Snail Mail - Dead End",
  "Rage Against the Machine - Maggie's Farm",
  "Corey Lueck - Down Hearted Blues",
  "Keepsake - Battlebots",
  "Daniel Caesar - Who Knows",
  "Perfume Genius - Queen",
  "The Belair Lip Bombs - Back of My Hand",
  "A$AP Rocky - PUNK ROCKY",
  "Jobi Riccio - Pilar, NM",
  "Big Richard - Alaska",
  "Dave Matthews Band - So Much to Say",
  "James McMurtry - The Black Dog and the Wandering Boy",
  "The Ragged Roses - Falling out of Love",
  "Jason Isbell - Bury Me",
  "Vandoliers - Life Behind Bars",
  "Christone \"Kingfish\" Ingram - Voodoo Charm",
  "Luke Winslow-King - Dangerous Blues",
  "Luke Winslow-King - Don't Worry Your Mind",
  "My Morning Jacket - Everyday Magic",
  "Lucy Dacus - Ankles"
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
          region: 'US',       // <--- DODAJ REGION
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

