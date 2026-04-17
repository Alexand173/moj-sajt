import { createClient } from '@supabase/supabase-js';
import RSSParser from 'rss-parser';
const parser = new RSSParser();
// Inicijalizacija Supabase klijenta
const supabaseUrl = process.env.SUPABASE_URL || '';
// Koristimo SERVICE_ROLE_KEY za pisanje, a ANON_KEY kao rezervu
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Greška: Nedostaju ključevi (URL ili KEY)!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchNews(query: string, region: string, apiKey: string) {
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=50&sortBy=publishedAt&apiKey=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.articles) {
      console.log(`⚠️ Nema vesti za region: ${region}`);
      return [];
    }
    
    console.log(`📡 Preuzeto ${data.articles.length} vesti za region: ${region}`);
    
    return data.articles.map((art: any) => ({
      title: art.title || 'No Title',
      excerpt: art.description || '',
      content: art.content || '',
      image: art.urlToImage || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
      category: 'LATEST',
      region: region,
      created_at: new Date(art.publishedAt || Date.now()).toISOString()
    }));
  } catch (error) {
    console.error(`❌ Greška pri fetch-ovanju za ${region}:`, error);
    return [];
  }
}

export async function GET() {
  console.log("🚀 Startujem punjenje baze...");

  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      throw new Error("Nedostaje NEWS_API_KEY u environment varijablama!");
    }

    const mojiFestivali = ['Coachella', 'Lollapalooza', 'Exit Festival', 'Tomorrowland'];

    const allResults = await Promise.all([
      fetchNews('music tour', 'us', apiKey),
      fetchNews('uk music charts', 'uk', apiKey),
      fetchNews('reggaeton latino', 'latino', apiKey),
      fetchNews('kpop music', 'asia', apiKey),
      fetchNews('europe music', 'europa', apiKey),
      fetchNews('world hits', 'world', apiKey),
      fetchNews('jazz music', 'jazz', apiKey),
      fetchNews('classical music', 'classical', apiKey),
      ...mojiFestivali.map(fest => fetchNews(fest, 'festivals', apiKey))
    ]);

    const allNews = allResults.flat().filter(news => news.title !== 'No Title');
    console.log(`📊 Ukupno sakupljeno vesti nakon filtriranja: ${allNews.length}`);

    if (allNews.length === 0) {
      return new Response(JSON.stringify({ message: "Nema novih vesti za unos." }), { status: 200 });
    }

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

    console.log("✅ Baza je uspešno osvežena!");
    return new Response(JSON.stringify({ 
      success: true, 
      count: allNews.length,
      message: "Baza osvežena." 
    }), { status: 200 });

  } catch (err: any) {
    console.error("❌ Kritična greška:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
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