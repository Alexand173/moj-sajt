import { createClient } from '@supabase/supabase-js';
//import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    // Tražimo specifično POP i ROCK
    const query = encodeURIComponent('("pop music" OR "rock music")');
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&pageSize=40&sortBy=publishedAt&apiKey=${apiKey}`
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