import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import RSSParser from 'rss-parser';

const parser = new RSSParser();

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
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

const SOURCES = [
  { name: 'Pitchfork Reviews', url: 'https://pitchfork.com/reviews/albums/', category: 'REVIEW' },
  { name: 'Rolling Stone Interviews', url: 'https://www.rollingstone.com/music/music-features/', category: 'INTERVIEW' },
  { name: 'NME Reviews', url: 'https://www.nme.com/reviews/album', category: 'REVIEW' }
];

export async function GET() {
  const allArticles: MusicArticle[] = [];

  // --- 1. DEO: CHEERIO SCRAPING (Tvoj originalni kod) ---
  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, { cache: 'no-store' });
      const html = await res.text();
      const $ = cheerio.load(html);

      $('a').each((i, el) => {
        const title = $(el).text().trim();
        const link = $(el).attr('href');
        const fullLink = link?.startsWith('http') ? link : `https://${new URL(source.url).hostname}${link}`;

        if (title.length > 5 && link) {
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

  // --- 2. DEO: RSS FETCH (Novi deo za Reviews) ---
  console.log("🏆 Fetching MTA Reviews via RSS...");
  const REVIEW_FEEDS = [
    { url: 'https://pitchfork.com/rss/reviews/albums/', cat: 'REVIEW' },
    { url: 'https://www.nme.com/reviews/album/feed', cat: 'REVIEW' },
    { url: 'https://www.rollingstone.com/music/music-news/feed/', cat: 'INTERVIEW' }
  ];

  for (const feedInfo of REVIEW_FEEDS) {
    try {
      const feed = await parser.parseURL(feedInfo.url);
      for (const item of feed.items) {
        let finalTitle = item.title || '';
        if (!finalTitle.toLowerCase().includes('review') && !finalTitle.toLowerCase().includes('interview')) {
          finalTitle = `${feedInfo.cat === 'REVIEW' ? 'Review' : 'Interview'}: ${item.title}`;
        }
        
        // BITNO: Koristimo allArticles (isti niz kao gore)
        allArticles.push({
          title: finalTitle,
          url: item.link || '',
          category: feedInfo.cat,
          region: 'Global',
          image: '',
          excerpt: item.contentSnippet?.slice(0, 160).replace(/\n/g, ' ') + '...' || 'Read more...',
          created_at: new Date(item.pubDate || new Date()).toISOString()
        });
      }
    } catch (e) {
      console.error("RSS Error:", e);
    }
  }

  // --- 3. DEO: SLANJE U BAZU ---
  // Uzimamo unikate po URL-u da ne dupliramo vesti
  const uniqueArticles = Array.from(new Map(allArticles.map(item => [item.url, item])).values());
  
  console.log("Ukupno pronađeno za bazu:", uniqueArticles.length);

  const { error } = await supabase
    .from('news')
    .upsert(uniqueArticles, { onConflict: 'url' });

  if (error) {
    console.error("Supabase Error:", error.message);
  }

  return new Response(JSON.stringify({ 
    success: !error, 
    count: uniqueArticles.length,
    error: error ? error.message : null 
  }));
}

/** * KLJUČNI DEO ZA GITHUB ACTIONS:
 */
if (typeof require !== 'undefined' && require.main === module) {
  GET()
    .then(async (res) => {
      const data = await res.json();
      console.log("🏁 Završeno!", data);
      process.exit(0);
    })
    .catch((err) => {
      console.error("💀 Skripta je pukla:", err);
      process.exit(1);
    });
}