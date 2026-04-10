import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Greška: Nedostaju ključevi!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funkcija koja precizno definiše šta tražimo za koju stranicu
async function fetchByCategory(query: string, regionTag: string, apiKey: string) {
  // Smanjio sam pageSize na 20 po kategoriji da ne bismo preopteretili API, ukupno će biti dosta vesti
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=20&sortBy=publishedAt&apiKey=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.articles) return [];

  return data.articles.map((art: any) => ({
    title: art.title,
    excerpt: art.description || '',
    content: art.content?.replace(/\[\+\d+ chars\]/g, '') || '',
    image: art.urlToImage || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    category: 'LATEST', 
    region: regionTag, // Ovo povezuje vest sa tvojim stranicama
    created_at: new Date(art.publishedAt)
  }));
}

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) throw new Error("Nedostaje API ključ");

    console.log("Započinjem ažuriranje svih muzičkih sekcija...");

    // Mapa svih tvojih stranica i specifičnih pretraga za njih
    const tasks = [
      fetchByCategory('music USA OR Billboard', 'us', apiKey),
      fetchByCategory('music UK OR Glastonbury OR "Official Charts"', 'uk', apiKey),
      fetchByCategory('Latino music OR Reggaeton OR "Latin Grammy"', 'latino', apiKey),
      fetchByCategory('K-pop OR J-pop OR "Music Asia"', 'asia', apiKey),
      fetchByCategory('Eurovision OR "European music scene"', 'europa', apiKey),
      fetchByCategory('Global music hits OR "World music"', 'world', apiKey),
      fetchByCategory('Jazz music OR "Jazz festival" OR Miles Davis', 'jazz', apiKey),
      fetchByCategory('Classical music OR Orchestra OR Opera', 'classical', apiKey)
    ];

    // Izvršavamo sve pretrage odjednom
    const results = await Promise.all(tasks);
    const allNews = results.flat(); // Spajamo sve liste u jednu veliku

    if (allNews.length === 0) {
      console.log("Nema vesti za ubacivanje.");
      return;
    }

    // Slanje u Supabase
    const { error } = await supabase
      .from('news')
      .upsert(allNews, { 
        onConflict: 'title', 
        ignoreDuplicates: true 
      });

    if (error) throw error;

    console.log(`🚀 Uspeh! Sve stranice su osvežene. Ubačeno ${allNews.length} vesti.`);
    
  } catch (err: any) {
    console.error("Kritična greška:", err.message);
    process.exit(1);
  }
}