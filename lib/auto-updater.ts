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
"Kitschkrieg • Shirin David - Gut genug (mit Blumengarten & Kitschkrieg)",
"Summer Cem • BILLA JOE - DUMAN 10",
"La Rvfleuze - Argent Sale - A COLORS SHOW",
"THIZZY52 - BLOCKKIDS",
"AK Ausserkontrolle - Hin und Her",
"THIZZY52 - BALOTELLI",
"Dj Aza • Ledavile • Dani Flow - Cucu de Teibolera",
"Draugr Balled - North wind calls",
"Lennsko - panzerknacker.wav",
"Malik Montana • Kazior • CUZCO$ - Saudi",
"Samra • Capital Bra - Ghetto Superstars",
"Luciano • Jazeek - THUG LIFE",
"Bob Dominator - Dragons Lair",
"Oge • Rack • MENJU - PALOMA",
"CDY • Jazeek • LACAZETTE • LACA - 15",
"AK Ausserkontrolle • Pashanim • Ads - Prada Sport",
"Cave • AMO • DEMO - NASENBLUTEN",
"Delli • Avie • 0 · 9 - LUNA&MONICA",
"Pashanim - Goldrichtig",
"Luciano • Jazeek • NINE - gimme luv <3",
"benno! • Epic - LOVE U ANYWAY",
"Aymen • SIRA • NiklasWilson - Rhythm",
"AK Ausserkontrolle • Shirin David • XY - LDNB",
"Sosa La M • 6PM RECORDS - LOVESICK",
"Summer Cem • Philemon • Bang - KILLY MANJARO - UNFRGTBL Re...",
"Coldyaa • Bamb - Coupe",
"Dardan • Azet • Fasti - Vermisse",
"Cash Flow • Tuğrul Bektas • BEŞ - Burda Geceler",
"Malik Montana • Kazior • CUZCOŞ - After",
"Malik Montana • Kazior - 30",
"AMO - Mala Fama",
"Dardan • Azet - Hmm Hmm",
"Dardan • Azet - Mitten in der Nacht",
"Bonez MC • Jugglerz • Gzuz - Sprite",
"Reezy - COMEBACCC",
"Bonez MC • Ufo361 • Lucy & Suena - Pharma",
"RAF Camora • Juju - KOMM NÄHER",
"AMO • Aymen • Aymo - Que pasa",
"marli • Philemon - Darling",
"Florida Juicy • Ikkimel • Barré - KOKOSNUSS",
"CANEY030 - BANGBANGBANG",
"Lucio101 • Nizi19 • LACAZETTE - +49",
"Fayan • Dalton - VERSPRICH MIR",
"Dardan • Azet - Joga Bonito",
"Pashanim - Augenblick",
"Philipp Dittberner • Bausa - Wolke 4",
"3robi • Aymen - Toni M",
"YBRE • CAMO23 - Superhelden",
"Rockywhereyoubeen • Avie • Orco - EUROS&KECHBAS",
"Juju - CRASHOUT FREESTYLE"



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
          genre_id: 3, // C-Pop
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

