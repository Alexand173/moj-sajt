import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { generateAiNewsArticle, getNewsSourceName } from '@/lib/ai-news';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // 3. Source retrieval + professional AI editorial generation
    for (const article of data.articles) {
      const sourceName = getNewsSourceName(article.url, article.source?.name);
      const aiResult = await generateAiNewsArticle({
        title: article.title,
        excerpt: article.description,
        existingContent: article.content,
        sourceUrl: article.url,
        sourceName,
      });

      if (!aiResult.similarityCheckPassed) {
        console.warn(
          `News rewrite for "${article.title}" was not saved as AI-validated content. ` +
          `similarity=${aiResult.similarityScore.toFixed(3)}, retries=${aiResult.retryCount}`,
        );
      }

      enrichedNews.push({
        title: aiResult.seoTitle || article.title,
        excerpt: aiResult.seoDescription || article.description?.slice(0, 200) || "",
        content: aiResult.articleContent || "Full article coming soon...",
        image: article.urlToImage || 'https://images.unsplash.com/photo-1514525253361-bee8a48790c3',
        url: article.url || null,
        source_name: sourceName,
        category: 'LATEST',
        region: selectedRegion,
        created_at: new Date(article.publishedAt).toISOString()
      });
    }

    // 4. Supabase deo
    const { error } = await supabase.from('news').upsert(enrichedNews, { onConflict: 'title' });
    
    if (error) throw error;

    return NextResponse.json({ success: true, count: enrichedNews.length, regionUsed: selectedRegion });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown news sync error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}