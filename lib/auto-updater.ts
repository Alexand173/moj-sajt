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
"Calvin Harris, Kasabian - Release The Pressure",
"David Guetta, Teddy Swims - Gone Gone Gone",
"Martin Garrix - Catharina",
"Tiësto, Brieanna Grace - Beautiful Places",
"Jax Jones, Emei - Stereo",
"Joel Corry - Stuck In A Loop",
"Nathan Dawe, Joel Corry - HIGHER",
"Alesso, Becky Hill - Surrender",
"Alan Walker, Dash Berlin - Better off (Alone, Pt. III)",
"Fred again.., Anderson .Paak - Places to Be",
"Anyma - Eternity (2026 Edit)",
"Barry Can't Swim, Aster Aweke - Chala (My Soul Is On A Loop)",
"Nia Archives - Cards on the Table",
"Overmono - Blow Out",
"Peggy Gou - It Makes You Forget (2026 Remix)",
"Disclosure - She’s Gone, Dance On",
"John Summit, LAVINIA - SHADOWS",
"Fisher, Tones And I - Favour",
"Dom Dolla - Girl$",
"Mau P - On My Mind",
"Purple Disco Machine - Beat Of Your Heart",
"Kungs, Mind Enterprises - Galaxy",
"Robin Schulz - Embers",
"Gorgon City, Interplanetary Criminal - Contact",
"Hannah Laing, Maddix - Transmission",
"Bicep - Chroma 001",
"Jamie xx - Baddy on the Floor",
"Skream - The Attention Deficit",
"Rudimental - Bring Me Joy",
"Chase & Status - Baddadan (2026 VIP)",
"Becky Hill, D.O.D - Side Effects (Remix)",
"Armin van Buuren, Glockenbach - Sun Shines on Me",
"Don Diablo, Pink Sweat$ - 5 Minutes",
"Alan Walker, Isabella Melkman - Broken Strings",
"Sigala - It's A Feeling",
"Jax Jones, Leony - Said It All (Rework)",
"Nathan Dawe, Abi Flynn - Hold On",
"D.O.D, Poppy Baskcomb - Confession",
"Ben Nicky, ARTY - Oxygen",
"Skytech, Alpharock - You're Not Alone",
"Calvin Harris, Jessie Reyez - Ocean",
"D.O.D, Ina Wroldsen - Paradise",
"David Guetta, Kim Petras - When We Were Young",
"Calvin Harris, Clementine Douglas - Blessings",
"KYANU - Be Right There",
"Ella Henderson, Switch Disco - Under The Sun",
"Henri PFR - The Night (belongs to lovers)",
"Tigerlily, Madism - Sway",
"Don Diablo, Felix Jaehn - Monster",
"Jack Wins, ILY - Dunno (What to Do)",
"Tiësto, FAST BOY - All My Life",
"Nathan Dawe - We Ain't Here For Long",
"Marc Benjamin, David Allen - Going On",
"Bassjackers, WUKONG - I Believe",
"Young Marco - What You Say?",
"Robbie Mendez - Memory",
"Jax Jones, Ina Wroldsen - Won't Forget You",
"Cassö, RAYE - Prada",
"Alok, Mae Stephens - Jungle",
"Lewis Thompson - Elevate",
"GATTÜSO - Unstoppable",
"Frank Walker, Ella Henderson - I Go Dancing",
"Alan Walker - Ritual",
"Alexandra Stan, NERVO - Come Into My World",
"Kettama - G-Town",
"Sammy Virji - Moonlight",
"Brutalismus 3000 - SPIRAL",
"Swimming Paul, Malaki - Swimming",
"Braaheim, EMMY - Raft",
"Leena Punks - Holding On",
"Blasterjaxx - Unfaithful",
"Maddix - My Fun",
"Secret Floor - Work To Tha Beat",
"ISOxo, Brutalismus 3000 - SPIRAL",
"Poltergst - Feuerzeug & Benzin",
"Artbat, R3hab - Fight Machine",
"Crankdat - Movement",
"Besomorph - Blind Proximity",
"Emily Makis - Too Fast",
"Disco Lines, Wes Mills - Starlight",
"Jackie Hollander - Addicted",
"Rivo, Cloves - Forever Till The End",
"Peekaboo, Flava D - Pump It Up",
"Four Tet, Nelly Furtado - Only Human (Remix)",
"Franky Rizardo - More To Life",
"Morgan Seatree - Beat Is Jumping",
"Miss Monique - Blue Moon Factory",
"G-Powered, Mikko L - You'll Never Leave",
"Nifra - Awaken Your Soul",
"Steve Aoki, Gammer - The Cruel Angel's Thesis",
"Marie Vaunt - Let the Bass Kick",
"Blossom, Mila Falls - Game Face",
"Eynka - Believe",
"Lavern - In My Head",
"Spartaque, Adrianna - Juego De Miradas",
"Valentino Khan, Proppa - Dale Earnhardt",
"1-800 GIRLS - Eye Contact",
"Bolo The DJ - Loca Loca",
"Snakehips, Cults - You & Me (Always Forever)",
"Dusky - Manticore",
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
          region: 'EUROPA',       // <--- DODAJ REGION
          genre_id: 6,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
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