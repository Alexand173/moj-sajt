import { createClient } from '@supabase/supabase-js';
import { enrichPendingNews } from '../../../lib/news-ai-enrichment';

// Inicijalizacija Supabase klijenta
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Koristimo SERVICE_ROLE_KEY za pisanje; ne izlažemo ga klijentu.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

interface NewsApiArticle {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  urlToImage?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  source?: { name?: string | null } | null;
}

interface NewsRecord {
  title: string;
  excerpt: string;
  content: string;
  image: string;
  url: string | null;
  category: string;
  region: string;
  created_at: string;
  ai_status: 'pending';
}

const MUSIC_KEYWORDS = [
  'music', 'concert', 'album', 'band', 'song', 'artist', 
  'tour', 'festival', 'singer', 'guitarist','drummer','rock band','metal band', 'dj', 'track', 'lyrics', 'kpop', 'jazz', 'reggaeton'
];

function isMusicRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return MUSIC_KEYWORDS.some(keyword => text.includes(keyword));
}

async function fetchNews(query: string, region: string, apiKey: string): Promise<NewsRecord[]> {
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=50&sortBy=publishedAt&apiKey=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      status?: string;
      message?: string;
      articles?: NewsApiArticle[];
    };
    
    // Ako API vrati status "error" ili neku poruku, ispiši je odmah u konzoli
    if (data.status === 'error') {
      console.log(`❌ News API Greška za region [${region}]: ${data.message || 'Nepoznata greška'}`);
      return [];
    }

    if (!data.articles || data.articles.length === 0) {
      console.log(`⚠️ Nema vesti na News API-ju za region: ${region}`);
      return [];
    }
    
    // 1. Filtriraj podatke (Ako je latino, propuštamo sve vesti bez filtriranja)
    const filteredArticles = data.articles.filter((art) => {
      if (region === 'latino') return true;
      return isMusicRelated(art.title || '', art.description || '');
    });
    
    // 2. Logujemo rezultat u konzolu
    console.log(`📡 Preuzeto ${data.articles.length}, filtrirano (muzičke) ${filteredArticles.length} vesti za region: ${region}`);
    
    // 3. Mapiranje za bazu podataka
    return filteredArticles.map((art) => ({
      title: art.title || 'No Title',
      excerpt: art.description || '',
      content: art.content || '',
      image: art.urlToImage || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
      url: art.url || null,
      category: 'LATEST',
      region: region,
      created_at: new Date(art.publishedAt || Date.now()).toISOString(),
      ai_status: 'pending',
    }));
  } catch (error) {
    console.error(`❌ Greška pri fetch-ovanju za ${region}:`, error);
    return [];
  }
}

export async function GET() {
  console.log("🚀 Startujem punjenje baze...");

  try {
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Missing Supabase server configuration.' }), { status: 500 });
    }

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      throw new Error("Nedostaje NEWS_API_KEY u environment varijablama!");
    }

    const mojiFestivali = [
      { name: 'Glastonbury', region: 'uk' },
      { name: 'Coachella', region: 'us' },
      { name: 'Tomorrowland', region: 'us' },
    ];
    
    // Definišemo jednostavne upite za latino muziku koji daju stabilne rezultate na engleskom

    
    const allResults = await Promise.all([
      fetchNews('music tour', 'us', apiKey),
      fetchNews('uk music news 2026 OR london music scene', 'uk', apiKey),
      fetchNews('reggaeton OR shakira OR "bad bunny" OR "latin music"', 'latino', apiKey),
      fetchNews('kpop music', 'asia', apiKey),
      fetchNews('europe music', 'europa', apiKey),
      fetchNews('world hits', 'world', apiKey),
      fetchNews('jazz music', 'jazz', apiKey),
      fetchNews('classical music', 'classical', apiKey),
      ...mojiFestivali.map(f => fetchNews(f.name, f.region, apiKey))
    ]);

    const allNews = allResults.flat().filter(news => news.title !== 'No Title');
    console.log(`📊 Ukupno sakupljeno vesti nakon filtriranja: ${allNews.length}`);

    if (allNews.length === 0) {
      const aiSummary = await enrichPendingNews(supabase);
      return new Response(JSON.stringify({
        message: "Nema novih vesti za unos.",
        ai: aiSummary,
      }), { status: 200 });
    }

    // Repair legacy rows that were created without a publisher URL.
    // The detail page can also repair a single row on demand, but this keeps
    // the regular six-hour sync from reintroducing incomplete source metadata.
    await Promise.all(
      allNews
        .filter((news) => news.url)
        .map(async (news) => {
          const { error: repairError } = await supabase
            .from('news')
            .update({ url: news.url })
            .eq('title', news.title)
            .is('url', null);

          if (repairError) {
            console.warn(`⚠️ Source URL repair failed for "${news.title}":`, repairError.message);
          }
        }),
    );

    // Unos u Supabase sa 'upsert' logikom na osnovu naslova
    const { error } = await supabase
      .from('news')
      .upsert(allNews, { 
        onConflict: 'title', 
        ignoreDuplicates: true 
      });

    if (error) {
      console.error("❌ Supabase Upsert Error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const aiSummary = await enrichPendingNews(supabase);
    console.log("🤖 AI news enrichment:", aiSummary);
    console.log("✅ Baza je uspešno osvežena!");
    return new Response(JSON.stringify({
      success: true,
      count: allNews.length,
      ai: aiSummary,
      message: "Baza osvežena."
    }), { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nepoznata greška';
    console.error("❌ Kritična greška:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

/** * KLJUČNI DEO ZA GITHUB ACTIONS:
 * Ovaj blok omogućava da 'npx tsx' direktno pokrene GET funkciju.
 */
if (typeof require !== 'undefined' && require.main === module) {
  console.log("🔔 Detektovano direktno pokretanje skripte (GitHub Actions)...");
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