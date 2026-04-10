import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Funkcija koja piše članak
async function generateFullArticle(title: string, snippet: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a senior music journalist at Rolling Stone magazine. 
      I will give you a headline and a small snippet, and you MUST write a 
      long, detailed, and engaging feature article (minimum 400 words).

      HEADLINE: "${title}"
      CONTEXT: "${snippet}"

      INSTRUCTIONS:
      1. Expansion: Use your internal knowledge about the artist(s) mentioned to add background, history, and context.
      2. Structure: 
         - Lead: A catchy opening about the current news.
         - Body: 2-3 deep paragraphs about the artist's career and why this news matters.
         - Fan Perspective: Mention the global impact and social media buzz.
         - Outro: What this means for the future of the artist.
      3. Tone: Professional, analytical, and rhythmic.
      4. Length: BE VERBOSE. Describe the atmosphere, the sound, and the industry impact in detail.

      Do not mention that you are an AI. Do not use generic filler. Write a REAL article.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Provera: Ako je i dalje prekratko, kažemo mu da dopuni (opciono)
    return responseText;
  } catch (error) {
    return snippet;
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
      const fullContent = await generateFullArticle(article.title, article.description || "");

      enrichedNews.push({
        title: article.title,
        excerpt: article.description?.slice(0, 200) || "",
        content: fullContent, 
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