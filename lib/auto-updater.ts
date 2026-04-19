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
"Malóne Morez - Rushin",
"DJ Pauly D - Feel It",
"Bart Skils & Weska - For The Music",
"SOFI TUKKER - BOBA",
"Afrojack & Lucas & Steve - Control",
"Vion Konger & Skytech - Zoom",
"KSHMR & Jason Ross & Brieanna Grace - Ultra Love",
"Layla Benitez & Jono Stephenson & Henri Bergmann - Parallax",
"Mike Posner & David Guetta - I Went Back To Ibiza",
"Adam Marcos & Alessa - Divine",
"Kygo & Khalid & Gryffin - Save My Love",
"Martin Garrix - Catharina",
"Zedd - Clarity (BUNT. Remix)",
"Leduc - The Lights",
"Mike Williams & Bruno Martini & Stephen Puth - Multiply",
"The Madison - Eternal Glow",
"ILLENIUM & Ellie Goulding - Don't Want Your Love",
"John Summit & The Chainsmokers & Ilsey - ALL THE TIME",
"FISHER - Rain",
"MEDUZA - Don't Wanna Go Home",
"Brooks & Justin Mylo & Philip Strand - Distant Love",
"Eddie Sender & Kate Tillmay - Trilobite",
"The Goo Goo Dolls & Steve Aoki - Iris",
"Aluna & Will Sass & Timbaland - Houseboy",
"EGGSTA & AOA - Out of Place",
"Faybl & Robbie Rosen - Immortal",
"John Newman - Love Me Again (Again)",
"bbyclose - dream about u",
"Layton Giordani & Camden Cox - Destiny",
"Don Diablo & Bipolar Sunshine - More Than a Friend",
"ILLENIUM & Bastille & Dabin - Feel Alive",
"Sonny Fodera & D.O.D & Poppy Baskcomb - Think About Us",
"Tanaka & Jessica Hammond - Flies On Me",
"Milky & Mall Grab - Just The Way You Are",
"Jai Nova - Twenty Four Seven",
"Disco Lines & Tinashe - No Broke Boys",
"Fragma & Vidojean X Oliver Loenn - Toca's Miracle (Edit)",
"Ewan McVicar - Share The House",
"Dylan McPhee & Rafiella - Can't Let Me Go",
"Sonny Fodera & Chrystal - My Loving",
"Jai Nova - Frozen In Time",
"Alison Limerick & MK - Where Love Lives (MK Remix)",
"Beave & Brett Haley - Body Movin'",
"Jai Nova - Back To Me",
"ANOTR & 54 Ultra - Talk To You",
"Dylan McPhee & Serena Sophia - Be Your Lover",
"Kato & Jon - Turn The Lights Off",
"Confidence Man - 17",
"Repiet & Julia Kleijn - Lifetime",
"Calvin Harris & Kasabian - Release The Pressure",
"Covenants & Angie Brown & Tom Brownlow - Hold That Sucker Down (Tom Brownlow Edit)",
"Denon Reed & BOVSKI - Let Him Go (BOVSKI Remix)",
"Ben Hemsley & Gaskin - If Your Girl",
"Eddie Craig & Ridney & Rhea Melvin - Don't Take Me For A Fool",
"Tinie Tempah & Alex Mills - Energy",
"Ian G & Angel Johnson - Tell Me on Sunday",
"IN PARALLEL & ROZZZQWEEN - I NEED A RHYTHM",
"Joey McCrilley - Sunset",
"Fafaq & DJ Kuba & Neitan - Spread Love",
"MK & Illyus Barrientos - Never Let You Go",
"Jess Bays & TCTS - Going Next",
"Tom Brownlow & JAIMEE - Stick Around",
"BIJOU - Temptation",
"Sub Focus & Culture Shock & Fragma - Miracle",
"Jai Nova - There For You",
"Ian G & Krysta Youngs - Body Highs",
"MK & Chrystal - Dior",
"Alok & Tazi & Samuele Sartini & Amanda Wilson & YORK - Seek Love",
"Confidence Man & Sweely - ALL MY PEOPLE (Edit)",
"Sidney Charles - Take It Back",
"DJs From Mars & Bombs Away & Melissa Grace - Download Me",
"Tom Brownlow - More Than Just A Love",
"GENNARO - Nothing Better Than Music",
"INViDA & Covenants & Curtis Richa - Deliverance",
"Scott Forshaw & Adam Griffin & Caitlyn Scarlett - Heart 2 Heart",
"Jai Nova - Come So Far",
"BURNS - The Anthem",
"Sara Landry & Godtripper - Reality Check",
"Progression & Ruben de Ronde & Daniel Wanrooy - Technophobia",
"Amelie Lens - Whatever You Do",
"RAM - Adagio for Strings (Ram's Adagio on Acid Mix)",
"Sean Dexter - Synthetica (Maite Dedecker Remix)",
"Township Rebellion & Fab Massimo - Labyrinth",
"ReOrder - 2024 Xoxo (Anewbis Remix)",
"Joy Kitikonti & Sygma - Agrimonyzer",
"Hannah Laing & Evil Twiin - Hijack The System",
"Eli Brown & Pan-Pot - Coming In Heavy",
"Fisherman - Life",
"Lilly Palmer - Bigger Than Techno",
"Alan Fitzpatrick & Reset Robot & HYBRD - Lose Control",
"Nicole Moudaber - Twisting My Mind",
"Maite Dedecker - Waves of Emotion",
"Charlotte de Witte - A Prayer for the Dancefloor",
"Andrea Scopsi & Patrick Scuro & Bouras - B.D.a.T",
"Miss Monique - Look At You",
"KREAM - Arrival",
"HILLS & Anyma - Dreams",
"Jast & Kevin de Vries - Born Like That",
"Mathame & Son of Son - Meet Me",
"Armin Van Buuren & Sacha - Set Me Free",
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
          genre_id: 6 ,        // <--- DODAJ ID ŽANRA (npr. 1 za Rock)
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