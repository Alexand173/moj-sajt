import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    let scrapedData: any[] = [];

    // 1. DEFINICIJA IZVORA PODELJENIH PO REGIONIMA
    const SOURCES = [
      // --- US SOURCES ---
     { url: 'https://pitchfork.com/news/', region: 'US' },
  { url: 'https://www.rollingstone.com/music/music-news/', region: 'US' },
  { url: 'https://www.billboard.com/c/music/music-news/', region: 'US' },
  { url: 'https://www.spin.com/category/news/', region: 'US' },
  { url: 'https://hiphopdx.com/news', region: 'US' },
  { url: 'https://www.complex.com/music/', region: 'US' },
  { url: 'https://www.stereogum.com/category/news/', region: 'US' },
  { url: 'https://consequence.net/category/music/news/', region: 'US' },
  { url: 'https://www.hotnewhiphop.com/news/', region: 'US' },
  { url: 'https://www.revolvermag.com/news', region: 'US' }, // Metal/Rock
  { url: 'https://www.vibe.com/c/news/', region: 'US' }, // R&B/Hip-Hop
  { url: 'https://www.altpress.com/news/', region: 'US' }, // Alternative
  { url: 'https://www.dancingastronaut.com/news/', region: 'US' }, // EDM
  { url: 'https://www.relix.com/news/', region: 'US' }, // Jam/Rock
  { url: 'https://variety.com/c/music/news/', region: 'US' },
  { url: 'https://www.thefader.com/category/music', region: 'US' },
  { url: 'https://ultimateclassicrock.com/category/latest-news/', region: 'US' },
  { url: 'https://www.rap-up.com/category/news/', region: 'US' },
  { url: 'https://news.pollstar.com/category/top-stories/', region: 'US' }, // Tour news
  { url: 'https://www.magneticmag.com/category/news/', region: 'US' }, // Electronic

  // --- UK SOURCES (20 SAJTOVA) ---
  { url: 'https://www.nme.com/news/music', region: 'UK' },
  { url: 'https://www.clashmusic.com/news/', region: 'UK' },
  { url: 'https://www.thelineofbestfit.com/news', region: 'UK' },
  { url: 'https://diymag.com/news', region: 'UK' },
  { url: 'https://www.gigwise.com/news/', region: 'UK' },
  { url: 'https://mne.com/news/', region: 'UK' },
  { url: 'https://www.loudersound.com/news', region: 'UK' }, // Classic Rock/Metal UK
  { url: 'https://www.kerrang.com/feed', region: 'UK' }, // Rock/Punk
  { url: 'https://www.residentadvisor.net/news', region: 'UK' }, // Electronic (UK based)
  { url: 'https://www.mixmag.net/news', region: 'UK' }, // Dance/Club
  { url: 'https://www.thequietus.com/news/', region: 'UK' }, // Indie/Experimental
  { url: 'https://www.musicweek.com/news', region: 'UK' }, // Industry news
  { url: 'https://www.uncut.co.uk/news/', region: 'UK' }, // Classic Indie
  { url: 'https://www.clashmusic.com/category/news/uk-news/', region: 'UK' },
  { url: 'https://www.rocksins.com/category/news/', region: 'UK' },
  { url: 'https://www.standard.co.uk/culture/music', region: 'UK' }, // London based
  { url: 'https://www.theguardian.com/music/music+tone/news', region: 'UK' },
  { url: 'https://www.dorkmag.com/news/', region: 'UK' }, // Pop/Indie
  { url: 'https://www.beatportal.com/news/', region: 'UK' }, // Beatport UK news
  { url: 'https://www.list.co.uk/music/', region: 'UK' }, // Scottish/UK events
   // --- LATINO (20 SAJTOVA) ---
  { url: 'https://www.billboard.com/c/music/latin/', region: 'LATINO' },
  { url: 'https://remezcla.com/music/', region: 'LATINO' },
  { url: 'https://www.rollingstone.com/music/music-latin/', region: 'LATINO' },
  { url: 'https://www.latido.music/category/news/', region: 'LATINO' },
  { url: 'https://urbano.nyc/category/noticias/', region: 'LATINO' },
  { url: 'https://www.efe.com/efe/espana/cultura/latin-music/50000495', region: 'LATINO' },
  { url: 'https://www.billboard.com/espanol/musica/', region: 'LATINO' },
  { url: 'https://www.mondosonoro.com/noticias-musica-latina/', region: 'LATINO' },
  { url: 'https://www.shock.co/musica', region: 'LATINO' },
  { url: 'https://www.lacoope.net/musica/noticias', region: 'LATINO' },
  // ... dodaj slične za LATINO do 20

  // --- ASIA (K-POP, J-POP & MORE - 20 SAJTOVA) ---
  { url: 'https://www.soompi.com/category/music', region: 'ASIA' },
  { url: 'https://www.allkpop.com/category/news', region: 'ASIA' },
  { url: 'https://www.koreaboo.com/category/news/', region: 'ASIA' },
  { url: 'https://www.nme.com/en_asia/news/music', region: 'ASIA' },
  { url: 'https://www.bandwagon.asia/news', region: 'ASIA' },
  { url: 'https://aramajapan.com/', region: 'ASIA' },
  { url: 'https://www.tokyohive.com/', region: 'ASIA' },
  { url: 'https://www.sbs.com.au/popasia/blog', region: 'ASIA' },
  { url: 'https://koreajoongangdaily.joins.com/section/entertainment', region: 'ASIA' },
  { url: 'https://www.hellokpop.com/category/news/', region: 'ASIA' },

  // --- EUROPA (20 SAJTOVA - Fokus na EU scenu) ---
  { url: 'https://www.eurovision.tv/news', region: 'EUROPA' },
  { url: 'https://www.europavox.com/news/', region: 'EUROPA' },
  { url: 'https://www.residentadvisor.net/news/europe', region: 'EUROPA' },
  { url: 'https://www.clashmusic.com/category/news/european-news/', region: 'EUROPA' },
  { url: 'https://www.rollingstone.de/news/', region: 'EUROPA' }, // Nemačka
  { url: 'https://www.lesinrocks.com/musique/', region: 'EUROPA' }, // Francuska
  { url: 'https://www.rockit.it/news', region: 'EUROPA' }, // Italija
  { url: 'https://www.jenesaispop.com/', region: 'EUROPA' }, // Španija
  { url: 'https://www.soundsblog.it/', region: 'EUROPA' },
  { url: 'https://www.muzikalia.com/noticias/', region: 'EUROPA' },
  { url: 'https://www.telerama.fr/musique', region: 'EUROPA' },
  { url: 'https://www.greenroom.fr/', region: 'EUROPA' },
  { url: 'https://www.musikexpress.de/news/', region: 'EUROPA' },
  { url: 'https://www.visions.de/news/', region: 'EUROPA' },

  // --- JAZZ (20 SPECIJALIZOVANIH) ---
  { url: 'https://jazztimes.com/news/', region: 'JAZZ' },
  { url: 'https://downbeat.com/news', region: 'JAZZ' },
  { url: 'https://www.allaboutjazz.com/news/', region: 'JAZZ' },
  { url: 'https://www.jazziz.com/category/news/', region: 'JAZZ' },
  { url: 'https://www.jazzwise.com/news', region: 'JAZZ' },
  { url: 'https://londonjazznews.com/', region: 'JAZZ' },
  { url: 'https://www.jazz24.org/category/news/', region: 'JAZZ' },
  { url: 'https://www.musiqology.com/category/jazz/', region: 'JAZZ' },
  { url: 'https://www.ejazznews.com/', region: 'JAZZ' },
  { url: 'https://www.nextbop.com/', region: 'JAZZ' },
  { url: 'https://www.jerryjazzmusician.com/', region: 'JAZZ' },
  { url: 'https://www.jazzonline.com/news/', region: 'JAZZ' },
  { url: 'https://www.jazzinamerica.org/', region: 'JAZZ' },
  { url: 'https://www.jazzstandard.com/', region: 'JAZZ' },
  { url: 'https://www.thejazzmann.com/news', region: 'JAZZ' },
  { url: 'https://www.bebopspokenhere.blogspot.com/', region: 'JAZZ' },
  { url: 'https://www.marlbank.net/', region: 'JAZZ' },
  { url: 'https://www.jazzfuel.com/blog/', region: 'JAZZ' },
  { url: 'https://www.bluenote.com/news/', region: 'JAZZ' },
  { url: 'https://www.jazznews.fr/actu/', region: 'JAZZ' },

  // --- CLASSICAL (20 SPECIJALIZOVANIH) ---
  { url: 'https://www.gramophone.co.uk/news', region: 'CLASSICAL' },
  { url: 'https://www.thestrad.com/news', region: 'CLASSICAL' },
  { url: 'https://www.classical-music.com/news', region: 'CLASSICAL' },
  { url: 'https://www.limelightmagazine.com.au/news/', region: 'CLASSICAL' },
  { url: 'https://www.operanews.com/Opera_News_Magazine/Archive/News.html', region: 'CLASSICAL' },
  { url: 'https://www.classicfm.com/news/', region: 'CLASSICAL' },
  { url: 'https://www.ludwig-van.com/toronto/category/news/', region: 'CLASSICAL' },
  { url: 'https://www.violinist.com/blog/', region: 'CLASSICAL' },
  { url: 'https://www.classicalmpr.org/category/classical-news', region: 'CLASSICAL' },
  { url: 'https://www.classical-scene.com/', region: 'CLASSICAL' },
  { url: 'https://www.pizzicato.lu/', region: 'CLASSICAL' },
  { url: 'https://www.classicalsource.com/news/', region: 'CLASSICAL' },
  { url: 'https://www.operawire.com/', region: 'CLASSICAL' },
  { url: 'https://www.bachtrack.com/news', region: 'CLASSICAL' },
  { url: 'https://www.wqxr.org/sections/classical-music-news/', region: 'CLASSICAL' },
  { url: 'https://www.classicalvoiceamerica.org/', region: 'CLASSICAL' },
  { url: 'https://www.musicalamerica.com/news/', region: 'CLASSICAL' },
  { url: 'https://www.theviolinchannel.com/category/news/', region: 'CLASSICAL' },
  { url: 'https://www.slippeidisc.com/', region: 'CLASSICAL' },
  { url: 'https://www.gramilano.com/', region: 'CLASSICAL' },

  // --- WORLD (Globalni miks) ---
  { url: 'https://www.songlines.co.uk/news', region: 'WORLD' },
  { url: 'https://worldmusiccentral.org/category/news/', region: 'WORLD' },
  { url: 'https://www.rootsworld.com/news.html', region: 'WORLD' },
  { url: 'https://www.rhythm-passport.com/news/', region: 'WORLD' },
  { url: 'https://www.globalmusicnetwork.com/', region: 'WORLD' }
];

    // 2. SKREPING PETLJA
    for (const source of SOURCES) {
      try {
        const res = await axios.get(source.url, { 
          timeout: 10000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
          } 
        });
        
        const $ = cheerio.load(res.data);
        const domainName = new URL(source.url).hostname.replace('www.', '');

        // LIMIT: Maksimalno 3 vesti po sajtu
        let countPerSite = 0;

        $('h2, h3').toArray().some((el) => {
          if (countPerSite >= 3) return true; // Prekidamo ako smo našli 3 vesti

          const title = $(el).text().trim();
          const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href');
          
          if (title.length > 25 && link) {
            const fullLink = link.startsWith('http') ? link : new URL(source.url).origin + link;
            
            scrapedData.push({
              title: title,
              excerpt: `SOURCE: ${domainName.toUpperCase()}`,
              image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745', // Placeholder
              category: 'OFFICIAL',
              region: source.region, // US ili UK
              url: fullLink,
              content: `Music update from ${domainName}`,
              created_at: new Date().toISOString()
            });

            countPerSite++;
          }
          return false;
        });
      } catch (e) {
        console.error(`Greška pri skreping sajta ${source.url}`);
      }
    }

    // 3. OBRADA PODATAKA I UPIS
    if (scrapedData.length > 0) {
      // Uklanjanje duplikata po naslovu (ako ih ima)
      const uniqueData = Array.from(
        new Map(scrapedData.map(item => [item.title, item])).values()
      );

      // MEŠANJE: Da se ne ređaju 3 vesti sa istog sajta jedna za drugom
      const mixedData = uniqueData.sort(() => Math.random() - 0.5);

      // Slanje u Supabase (Upsert radi update ako naslov već postoji)
      const { error } = await supabase
        .from('news')
        .upsert(mixedData, { 
          onConflict: 'title',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      
      return NextResponse.json({ 
        success: true, 
        count: mixedData.length,
        message: `Successfully scraped ${mixedData.length} official news across US and UK.`
      });
    }

    return NextResponse.json({ success: true, count: 0, message: "No new data found." });

  } catch (error: any) {
    console.error("Scraper Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

//KLJUČNI DEO ZA GITHUB ACTIONS:
// Omogućava direktno pokretanje preko npx tsx
 
  if (typeof require !== 'undefined' && require.main === module) {
  console.log("🔔 Pokrećem Official Scraper...");
  GET()
    .then(async (res) => {
      const data = await res.json();
      console.log("🏁 Završeno!", data);
      process.exit(0);
    })
    .catch((err) => {
      console.error("💀 Greška:", err);
      process.exit(1);
    });
  }}