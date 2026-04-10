import { createClient } from '@supabase/supabase-js';

// --- OVDE ZAMENI SA TVOJIM PODACIMA ---
const SUPABASE_URL = 'https://irqjjoksexiasddmxbgs.supabase.co'; // Nađi u Supabase -> Settings -> API -> Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycWpqb2tzZXhpYXNkZG14YmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDE1NjksImV4cCI6MjA5MDg3NzU2OX0.v4fX_-KtTUO3qbctoKCNkVIikg4W3V5uuzQ86rLoYXo';           // Nađi u Supabase -> Settings -> API -> anon public
const LASTFM_KEY = '6366f556091bfab1aae1f95e8daf0afd';           // Onaj ključ što si dobio na Last.fm-u
// --------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixAllGenres() {
  console.log("🚀 Pokrećem ažuriranje žanrova...");

  // 1. Uzmi sve pesme iz baze koje trenutno imaju žanr "Popularno" ili su prazne
  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title, artist_name');

  if (error) {
    console.error("❌ Greška pri čitanju baze:", error.message);
    return;
  }

  if (!songs || songs.length === 0) {
    console.log("ℹ️ Nema pesama u bazi za ažuriranje.");
    return;
  }

  console.log(`🔍 Pronađeno ${songs.length} pesama. Krećem sa proverom na Last.fm...`);

  for (const song of songs) {
    const artist = song.artist_name;
    const track = song.title;

    // 2. Formiraj URL za Last.fm API
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`;

    try {
      const res = await fetch(url);
      const json = await res.json();

      let newGenre = 'WORLD'; // Default ako ništa ne nađe

      // Proveri da li Last.fm ima tagove za ovu pesmu
      if (json.track && json.track.toptags && json.track.toptags.tag && json.track.toptags.tag.length > 0) {
        // Uzmi prvi (najpopularniji) tag i pretvori u velika slova
        let rawTag = json.track.toptags.tag[0].name.toUpperCase();

        // Mala optimizacija: Ako tag sadrži reč HIP HOP, postavi samo HIP-HOP
        if (rawTag.includes('HIP')) newGenre = 'HIP-HOP';
        else if (rawTag.includes('ROCK')) newGenre = 'ROCK';
        else if (rawTag.includes('POP')) newGenre = 'POP';
        else if (rawTag.includes('LATIN')) newGenre = 'LATIN';
        else if (rawTag.includes('ELECTRONIC') || rawTag.includes('EDM')) newGenre = 'EDM';
        else newGenre = rawTag;
      }

      // 3. Ažuriraj pesmu u Supabase bazi
      const { error: updateError } = await supabase
        .from('songs')
        .update({ genre: newGenre })
        .eq('id', song.id);

      if (updateError) {
        console.error(`❌ Greška pri upisu za ${artist} - ${track}:`, updateError.message);
      } else {
        console.log(`✅ ${artist} - ${track} -> [${newGenre}]`);
      }

    } catch (e) {
      console.error(`❌ Mrežna greška za ${artist} - ${track}:`, e.message);
    }

    // Mala pauza od 200ms da ne bismo "bombardovali" API prebrzo
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\n✨ GOTOVO! Svi žanrovi su osveženi.");
}

fixAllGenres();