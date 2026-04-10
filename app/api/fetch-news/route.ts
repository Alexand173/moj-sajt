import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Greška: Nedostaju ključevi!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchNews(query: string, region: string, apiKey: string) {
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=15&sortBy=publishedAt&apiKey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (!data.articles) {
    console.log(`Nema vesti za: ${region}`);
    return [];
  }
  
  return data.articles.map((art: any) => ({
    title: art.title || 'No Title',
    excerpt: art.description || '',
    content: art.content || '',
    image: art.urlToImage || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    category: 'LATEST',
    region: region,
    created_at: new Date(art.publishedAt || Date.now())
  }));
}

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) throw new Error("Fali API Key");

    console.log("Startujem punjenje...");

    const allResults = await Promise.all([
      fetchNews('music tour', 'us', apiKey),
      fetchNews('uk music charts', 'uk', apiKey),
      fetchNews('reggaeton latino', 'latino', apiKey),
      fetchNews('kpop music', 'asia', apiKey),
      fetchNews('europe music', 'europa', apiKey),
      fetchNews('world hits', 'world', apiKey),
      fetchNews('jazz music', 'jazz', apiKey),
      fetchNews('classical music', 'classical', apiKey)
    ]);

    const allNews = allResults.flat();
    console.log(`Ukupno sakupljeno vesti: ${allNews.length}`);

    if (allNews.length === 0) {
      console.log("API nije vratio nista.");
      return;
    }

    // REŠENJE: Koristimo upsert sa onConflict i ignoreDuplicates
    const { error } = await supabase
      .from('news')
      .upsert(allNews, { 
        onConflict: 'title', 
        ignoreDuplicates: true 
      });

    if (error) {
      console.error("Supabase Error:", error.message);
      process.exit(1);
    }

    console.log("🚀 Baza je uspesno osvezena novim vestima!");
  } catch (err: any) {
    console.error("Greska:", err.message);
    process.exit(1);
  }
}

// Okidač za robota
GET().then(() => {
    console.log("✅ Robot je uspešno završio posao!");
    process.exit(0);
}).catch((err) => {
    console.error("❌ Greška:", err);
    process.exit(1);
});get