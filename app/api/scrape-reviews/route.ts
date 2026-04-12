import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Definišemo strukturu članka da TypeScript ne bi izbacivao grešku
interface MusicArticle {
  title: string;
  url: string;
  category: string;
  region: string;
  image: string;
  excerpt: string;
  created_at: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!, // Izbrisali smo NEXT_PUBLIC_ jer GitHub šalje SUPABASE_URL
  process.env.SUPABASE_ANON_KEY!
);

const SOURCES = [
  { name: 'Pitchfork Reviews', url: 'https://pitchfork.com/reviews/albums/', category: 'REVIEW' },
  { name: 'Rolling Stone Interviews', url: 'https://www.rollingstone.com/music/music-features/', category: 'INTERVIEW' },
  { name: 'NME Reviews', url: 'https://www.nme.com/reviews/album', category: 'REVIEW' }
];

export async function GET() {
  // Ovde dodajemo tip : MusicArticle[]
  const allArticles: MusicArticle[] = [];

  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, { cache: 'no-store' });
      const html = await res.text();
      const $ = cheerio.load(html);

      $('a').each((i, el) => {
        const title = $(el).text().trim();
        const link = $(el).attr('href');
        const fullLink = link?.startsWith('http') ? link : `https://${new URL(source.url).hostname}${link}`;

        if (title.length > 30 && link) {
          allArticles.push({
            title,
            url: fullLink,
            category: source.category,
            region: 'GLOBAL',
            image: '', 
            excerpt: 'Click to read this full feature.',
            created_at: new Date().toISOString()
          });
        }
      });
    } catch (err) {
      console.log(`Greška pri skrepovanju ${source.name}`);
    }
  }

  const uniqueArticles = allArticles.slice(0, 15); 
  const { error } = await supabase.from('news').upsert(uniqueArticles, { onConflict: 'url' });

  return new Response(JSON.stringify({ success: !error, count: uniqueArticles.length }));
}