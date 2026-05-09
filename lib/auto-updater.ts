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
  
"Milky - Just The Way You Are",

"Disco Lines & Tinashe - No Broke Boys",

"Anotr / 54 Ultra - Talk To You",

"Prospa / Cloonee - Free Your Mind",

"Haven ft. Kaitlin Aragon - I Run",

"Calvin Harris / Douglas - Blessings",

"Sonny Fodera / D.O.D / Baskcomb - Think About Us",

"Bebe Rexha & Faithless - New Religion",

"Chrystal - The Days",

"Michael Jackson - They Don't Care About Us",

"Calvin Harris - Feel So Close",

"Disclosure ft. Sam Smith - Latch",

"Ewan Mcvicar - Share The House",

"DJ Snake ft. Justin Bieber - Let Me Love You",

"Robin S - Show Me Love",

"Rihanna ft. Calvin Harris - We Found Love",

"MK ft. Chrystal - Dior",

"Lonown / Riserayss - Worry",

"Sonny Fodera / Jazzy / D.O.D - Somedays",

"Bl3ss / Camrinwatsin / Bbyclose - Kisses",

"Casso / Raye / D-Block Europe - Prada",

"Calvin Harris - Summer",

"Avicii - Wake Me Up",

"Mike Posner - I Took A Pill In Ibiza",

"Bob Sinclar ft. Steve Edwards - World Hold On (Fisher Rework)",

"Clean Bandit ft. Jess Glynne - Rather Be",

"Skrillex & Diplo / Justin Bieber - Where Are U Now",

"Calvin Harris & Disciples - How Deep Is Your Love",

"David Guetta ft. Sia - Titanium",

"Faithless - Insomnia",

"Morgan Seatree - Say My Name",

"Chainsmokers & Coldplay - Something Just Like This",

"LF System - Afraid To Feel",

"Stardust - Music Sounds Better With You",

"Calvin Harris & Dua Lipa - One Kiss",

"Jonas Blue & Malive - Edge of Desire",

"Calvin Harris & Kasabian - Release The Pressure",

"Major Lazer ft. Mø & DJ Snake - Lean On",

"Calvin Harris ft. Rihanna - This Is What You Came For",

"Everything But The Girl - Missing",
"Tinie Tempah, Alex Mills - Energy",

"Josh Baker, Sienna Sophia - Come Closer (feat. Sienna Sophia)",

"Simon Field, Eyez - Chain Gun (Radio Edit)",

"Benny Benassi, Tobias Gerard - DISCOTEKA",

"SOSA - Be Without You",

"Odd Mob, OMNOM, HYPERBEAM - Coming Up (It's Dare)",

"SIDEPIECE - Cry For You (2025)",

"Matroda, KLP - Bullshit",

"DJ Glen, Shady Jones - Hypnotize",

"Ethan Walsh - Look Good",

"Simon Field - PanAm - Radio Edit",

"Le Zinc - House Is A River",

"Jamback - Positive",

"Vinter - Space Pump (Space Jam)",

"Kolter, Nate Dogg - Liquor Store (feat. Nate Dogg)",

"James Hype, A.D.O.R. - Behaviour (feat. A.D.O.R.)",

"HUGEL, Maesic, Omada - Dubai Shit - Extended Mix",

"Jump Kid - Jump Kid",

"Sonny Fodera, D.O.D, Poppy Baskcomb - Think About Us",

"PLUS2 - Rhythm n' Beat",

"L.P. Rhythm - Versatile",

"Cloonee, Young M.A, InntRaw, HNTR - Stephanie - HNTR Remix",

"Sammy Virji, Chris Lake, RoRo - 925",

"Fallon - Diet Coke",

"Shermanology - Give You My Luv",

"BUJA (BR) - Dagger Hit",

"John Newman, SIX40TWO - Something In The Water",

"Sidney Charles - Take It Back (To The Old School)",

"Mason Collective - Restless",

"HILLS - Coolin",

"Luuk Van Dijk - Disco Tetris - Edit",

"OMRI., Dakota - Unholy",

"Dimon - I Just Wanna",

"Chris Stussy - It's About Us",

"CHANEY, Paige Bea - Falling Into You",

"Dom Dolla, Daya - Dreamin (feat. Daya)",

"Danny Howard, Joshwa, Mahalia Fontaine - (This Is A) Warning",

"Elbio & Denis - Work Me",

"Büya, OJOG - Pjanoo",

"Simon Field, Angie Brown - Trouble",

"Todd Terry, Simon Field - My House Is On Fire",

"Kokiri, Kelli-Leigh - Let's Get Out (feat. Kelli-Leigh)",

"Biscits - Freak",

"FISHER, AR/CO - Ocean",

"Riordan - Gimme",

"Charli xcx, Skream & Benga - Von dutch remix with skream & benga",
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