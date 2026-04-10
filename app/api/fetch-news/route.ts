import { createClient } from '@supabase/supabase-js';
//import { NextResponse } from 'next/server';

// 1. Prvo definišeš promenljive VAN zagrada
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseKey) {
  console.error("Greška: Nedostaju SUPABASE_URL ili SUPABASE_ANON_KEY!");
  process.exit(1);
}
// 2. Onda napraviš klijenta koristeći te promenljive
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    // Tražimo specifično POP i ROCK
    const query = 'music OR "new album" OR "concert tour"';

const response = await fetch(
  `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=140&sortBy=publishedAt&apiKey=${apiKey}`
);
    const data = await response.json();

    const newsToInsert = data.articles.map((art: any) => ({
      title: art.title,
      excerpt: art.description || '',
      content: art.content?.replace(/\[\+\d+ chars\]/g, '') || '',
      image: art.urlToImage || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
      category: 'LATEST',
      region: 'us',
      created_at: new Date(art.publishedAt)
    }));

    // UPSERT: Ovo automatski ažurira tabelu
    const { error } = await supabase
      .from('news')
      .upsert(newsToInsert, { 
        onConflict: 'title', // Gleda kolonu title (koja je Unique)
        ignoreDuplicates: true 
      });

   if (error) throw error;

    // UMESTO NextResponse, koristi console.log
    console.log("Uspeh: Tabela osvežena!");
    
  } catch (err: any) {
    // UMESTO NextResponse, koristi console.error
    console.error("Greška:", err.message);
    process.exit(1); // Ovo govori GitHub-u da je došlo do greške ako nešto pukne
  }
}