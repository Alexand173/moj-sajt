import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function GET() {
  try {
    // 1. Inicijalizacija modela UNUTAR GET funkcije da bi bio vidljiv svuda dole
    // Koristimo "gemini-1.5-flash" jer je najbrži
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=US Music Festivals 2026 dates&language=en&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`
    );
    const newsData = await newsRes.json();

    if (!newsData.articles) throw new Error("NewsAPI nije vratio ništa.");

    const festivalsToInsert = [];

    for (const article of newsData.articles) {
      const prompt = `
        Extract festival info from: "${article.title}". 
        Return ONLY JSON: {"name": "Name", "location": "City, State", "date_start": "YYYY-MM-DD"}. 
        If not a festival, return null.
      `;

      // Ovde je bila greška - sada 'model' postoji!
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      try {
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const festData = JSON.parse(cleanJson);

        if (festData && festData.name) {
          festivalsToInsert.push({
            name: festData.name,
            location: festData.location || "USA",
            date_start: festData.date_start || "2026-06-01",
            image_url: article.urlToImage || 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3',
            description: article.description?.slice(0, 200),
            tickets_url: article.url,
            region: 'us'
          });
        }
      } catch (e) {
        continue; // Preskoči ako AI lupi glupost
      }
    }

    if (festivalsToInsert.length > 0) {
      const { error } = await supabase.from('festivals').upsert(festivalsToInsert, { onConflict: 'name' });
      if (error) throw error;
    }

    return NextResponse.json({ success: true, count: festivalsToInsert.length });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}