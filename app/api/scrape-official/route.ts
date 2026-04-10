import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALL_DOMAINS = [
  "https://taylorswift.com", "https://beyonce.com", "https://arianagrande.com", 
  "https://billieeilish.com", "https://dualipa.com", "https://theweeknd.com", 
  "https://hstyles.co.uk", "https://justinbiebermusic.com", "https://ladygaga.com", 
  "https://oliviarodrigo.com", "https://mileycyrus.com", "https://selenagomez.com", 
  "https://brunomars.com", "https://edsheeran.com", "https://katyperry.com", 
  "https://iamhalsey.com", "https://lanadelrey.com", "https://camilacabello.com", 
  "https://shawnmendesofficial.com", "https://sabrinacarpenter.com", "https://tatemcrae.com", 
  "https://dojacat.com", "https://szasolana.com", "https://lizzomusic.com", 
  "https://charlixcx.com", "https://drakerelated.com", "https://oklama.com", 
  "https://yeezy.com", "https://travisscott.com", "https://freebandz.com", 
  "https://postmalone.com", "https://nickiminajofficial.com", "https://cardibofficial.com", 
  "https://store.megantheestallion.com", "https://jackharlow.us", "https://lilnasx.com", 
  "https://21savage.com", "https://dreamville.com", "https://eminem.com", 
  "https://golfwang.com", "https://awge.com", "https://iamlilbaby.com", 
  "https://youngthugmusic.com", "https://unveranosinti.com", "https://blonded.co", 
  "https://janellemonae.com", "https://thenightday.com", "https://playboicarti.com", 
  "https://icespicemusic.com", "https://centralcee.com", "https://foofighters.com", 
  "https://redhotchilipeppers.com", "https://coldplay.com", "https://imaginedragonsmusic.com", 
  "https://arcticmonkeys.com", "https://thekillersmusic.com", "https://paramore.net", 
  "https://twentyonepilots.com", "https://hozier.com", "https://noahkahan.com", 
  "https://the1975.com", "https://florenceandthemachine.net", "https://gorillaz.com", 
  "https://radiohead.com", "https://pearljam.com", "https://metallica.com", 
  "https://gunsnroses.com", "https://greenday.com", "https://blink182.com", 
  "https://panicatthedisco.com", "https://machinegunkelly.com", "https://lorde.co.nz", 
  "https://phoebefuckingbridgers.com", "https://thelumineers.com", "https://boniver.org", 
  "https://morganwallen.com", "https://lukecombs.com", "https://zachbryan.com", 
  "https://chrisstapleton.com", "https://carrieunderwoodofficial.com", "https://kaceymusgraves.com", 
  "https://kanebrownmusic.com", "https://thomasrhett.com", "https://laineywilson.com", 
  "https://dollyparton.com", "https://calvinharris.com", "https://davidguetta.com", 
  "https://tiesto.com", "https://thechainsmokers.com", "https://skrillex.com", 
  "https://marshmellomusic.com", "https://zedd.net", "https://brucespringsteen.net", 
  "https://eltonjohn.com", "https://paulmccartney.com", "https://rollingstones.com", 
  "https://madonna.com", "https://cher.com", "https://steviewonder.net", "https://billyjoel.com"
];

export async function GET() {
  // Uzimamo samo 10 nasumičnih da bismo izbegli Timeout
  const sample = ALL_DOMAINS.sort(() => 0.5 - Math.random()).slice(0, 10);
  const scrapedData: any[] = [];

  const results = await Promise.allSettled(
    sample.map(async (domain) => {
      // Pokušavamo da nađemo vesti na /news ili /blog podstranici
      const targetUrl = `${domain}/news`;
      const res = await axios.get(targetUrl, { 
        timeout: 7000,
        headers: { 'User-Agent': 'Mozilla/5.0' } 
      });
      
      const $ = cheerio.load(res.data);
      // Tražimo bilo koji naslov i link
      $('h1, h2, h3').each((i, el) => {
        const title = $(el).text().trim();
        if (title.length > 20) { // Filtriramo kratke stvari koje nisu naslovi
          scrapedData.push({
            title,
            excerpt: `Official update from ${domain}`,
            image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745', // Default slika
            category: 'OFFICIAL',
            region: 'world',
            content: `Check official updates at ${domain}`,
            created_at: new Date().toISOString()
          });
        }
      });
    })
  );

  if (scrapedData.length > 0) {
    // Upsert u bazu
    await supabase.from('news').upsert(scrapedData.slice(0, 20), { onConflict: 'title' });
  }

  return NextResponse.json({ 
    success: true, 
    message: `Obrađeno 10 sajtova, pronađeno ${scrapedData.length} potencijalnih vesti.` 
  });
}