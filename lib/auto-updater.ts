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
 "Papa Roach • HanuMankind - See U in Hell (from the Netflix Series)",
"Motionless in White - Afraid Of The Dark",
"Evanescence - Who Will You Follow",
"Maphra - Doomed",
"Treaty Oak Revival - 12 Steps (feat. Treaty Oak Reviva)",
"mgk • Fred Durst - FIX UR FACE (with Fred Durst)",
"Motionless in White • Corey Taylor - Playing God (feat. Corey Taylor)",
"Ice Nine Kills • McKenna Grace - Twisting The Knife (feat. Mckenna Grace)",
"Five Finger Death Punch - Eye Of The Storm",
"Ragal Ironbull - VIKING VIBES",
"Breaking Benjamin - Something Wicked",
"IngaRose - Feeling Good Today",
"Arjan Dhillon • Jay Trak - No Shortcut",
"The Red Clay Strays - Demons In Your Choir",
"I Prevail • Amira Elfeky - Paradise",
"Ice Nine Kills - Play Dead",
"Ian McConnell - Bangladesh",
"Korn - Reward the Scars",
"Maphra - Circle With Me",
"Greta Van Fleet - Play Your Games",
"From Ashes to New - Die For You",
"Arjan Dhillon • Jay Trak - 420 Miles",
"IngaRose - Love Me When It’s Hard",
"Foo Fighters - Window",
"A Perfect Circle - Starless",
"Marilyn Manson - Exit Wound",
"Five Finger Death Punch - De Oppresso Liber",
"Jack White - Dollar Bill",
"A Day to Remember • Bilmuri - ALWAYS LET YOU DOWN",
"Lauren Sanderson • Fred Durst - COME SAY SUM (feat. Fred Durst)",
"IngaRose - PIECE BY PIECE",
"Jack White - G.O.D. And The Broken Ribs",
"Sleeping With Sirens - House Of Matches",
"The Red Clay Strays - Do Today",
"IngaRose - Not for me",
"Austin Meade • Treaty Oak Revival - Rio Grande",
"Papa Roach • Power Glove - Getting Away with Murder (Power...)",
"Sleep Theory - My Heart",
"Sublime - Until The Sun Explodes",
"The Red Clay Strays - If I Didn't Know You",
"Evanescence - Tell Me When You've Had Enough",
"duskydemise archive • duskydemise - bedrott (feat. duskydemise) (slow...)",
"Catch Your Breath - Control",
"Beartooth - Bullshit",
"Hollywood Undead - Feels Like Home",
"Ekoh • Lø Spirit • Ninth Key - IFIWASN'T ME",
"Jeris Johnson - BANGDYBANG",
"Mat Mitchell • Return to Dust - Hey Ya! (feat. Mat Mitchell of F**k)",
"Sueco • Jeris Johnson - ARE YOU ENTERTAINED? (with Sueco)",
"Beartooth - Free"
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
          region: 'US',
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