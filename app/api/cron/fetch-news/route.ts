import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Funkcija koja piše članak sa SEO optimizacijom
async function generateFullArticle(originalTitle: string, snippet: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a senior music journalist and SEO expert. 
      I will give you a headline and a small snippet, and you MUST generate a response in JSON format.

      HEADLINE: "${originalTitle}"
      CONTEXT: "${snippet}"

      JSON STRUCTURE:
      {
        "seoTitle": "A catchy, keyword-rich SEO title (max 60 chars)",
        "seoDescription": "A compelling meta description summarizing the news (max 155 chars)",
        "articleContent": "A long, detailed feature article (minimum 400 words). Use background history, fan perspective, and industry impact."
      }

      INSTRUCTIONS:
      1. Tone: Professional, analytical, and rhythmic.
      2. Format: Return ONLY valid JSON. No markdown formatting around the JSON.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Čistimo JSON ako AI doda markdown blokove
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return parsed;
  } catch (error) {
    return {
      seoTitle: originalTitle,
      seoDescription: snippet.slice(0, 150),
      articleContent: snippet
    };
  }
}

export async function GET(request: Request) {
  try {
    // 1. OVO MORA BITI NA SAMOM VRHU
    const { searchParams } = new URL(request.url);
    const selectedRegion = searchParams.get('region') || 'world'; 

    // 2. Tvoj fetch poziv
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=(Taylor Swift OR Metallica OR Drake)&language=en&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`
    );
    const data = await res.json();

    const enrichedNews = [];

    // 3. AI petlja
    for (const article of data.articles) {
      const aiResult = await generateFullArticle(article.title, article.description || "");

      enrichedNews.push({
        title: aiResult.seoTitle || article.title,
        excerpt: aiResult.seoDescription || article.description?.slice(0, 200) || "",
        content: aiResult.articleContent || "Full article coming soon...", 
        image: article.urlToImage || 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3',
        category: 'AI EXCLUSIVE',
        // OVDE KORISTIMO VARIJABLU DEFINISANU NA VRHU
        region: selectedRegion, 
        created_at: new Date(article.publishedAt).toISOString()
      });
    }

    // 4. Supabase deo
    const { error } = await supabase.from('news').upsert(enrichedNews, { onConflict: 'title' });
    
    if (error) throw error;

    return NextResponse.json({ success: true, count: enrichedNews.length, regionUsed: selectedRegion });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}