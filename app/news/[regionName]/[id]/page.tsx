import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import StructuredData from '@/components/StructuredData';
import { getNewsSourceName } from '@/lib/ai-news';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
// Keep article pages dynamic, but never let an external provider block HTML rendering.
export const revalidate = 0;

const getSupabase = () => getPublicSupabaseClient();

interface NewsArticleRecord {
  id: string | number;
  title: string;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  url: string | null;
  category: string | null;
  created_at: string | null;
  ai_content: string | null;
  ai_similarity_score: number | null;
  ai_generated: boolean | null;
  ai_status: string | null;
}

function getSafeSourceUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function getArticlePageUrl(regionName: string, id: string): string {
  return `https://musictop.net/news/${encodeURIComponent(regionName)}/${encodeURIComponent(id)}`;
}

const getNewsArticle = cache(async (id: string): Promise<NewsArticleRecord | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as NewsArticleRecord;
  } catch (error) {
    console.warn(`Could not load news article ${id}:`, error);
    return null;
  }
});

/**
 * Article rendering uses only stored fields. Source scraping and AI generation
 * belong in the background enrichment job, not in a crawler-facing request.
 */
const getResolvedSource = cache(async (article: NewsArticleRecord) => {
  const sourceUrl = getSafeSourceUrl(article.url);

  return {
    sourceUrl,
    sourceName: getNewsSourceName(sourceUrl),
    sourceArticleText: '',
    excerpt: article.excerpt?.trim() || '',
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}): Promise<Metadata> {
  const { id, regionName } = await params;
  const article = await getNewsArticle(id);

  if (!article) {
    return { title: 'Article not found | MusicTop' };
  }

  const resolvedSource = await getResolvedSource(article);
  const sourceName = resolvedSource.sourceName;
  const pageUrl = getArticlePageUrl(regionName, id);
  const description = `Source-attributed MusicTop reporting based on reporting by ${sourceName}. ${article.excerpt || 'Read the source-attributed music news report.'}`.slice(0, 180);
  const imageUrl = getSafeSourceUrl(article.image);
  const sourceUrl = getSafeSourceUrl(resolvedSource.sourceUrl);

  return {
    title: `${article.title} | ${sourceName}`,
    description,
    authors: [{ name: 'MusicTop Editorial' }],
    creator: 'MusicTop Editorial',
    publisher: 'MusicTop',
    alternates: { canonical: pageUrl },
    openGraph: {
      title: article.title,
      description,
      url: pageUrl,
      siteName: 'MusicTop',
      type: 'article',
      publishedTime: article.created_at || undefined,
      authors: ['MusicTop Editorial'],
      images: imageUrl ? [{ url: imageUrl, alt: article.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    other: {
      'article:source': sourceName,
      ...(sourceUrl ? { 'article:source_url': sourceUrl } : {}),
      'article:content_origin': article.category === 'LATEST'
        ? 'AI-synthesized report based on source reporting'
        : 'Official publisher link',
    },
  };
}

export default async function SingleNewsPage({
  params
}: {
  params: Promise<{ regionName: string, id: string }>
}) {
  const { id, regionName } = await params;

  const article = await getNewsArticle(id);

  if (!article) {
    return <div className="pt-60 text-center uppercase font-black">Article not found.</div>;
  }

  const resolvedSource = await getResolvedSource(article);

  const sourceName = resolvedSource.sourceName;
  const isLatestNews = article.category === 'LATEST';
  const aiArticle = article.ai_content?.trim()
    ? {
        seoTitle: article.title,
        seoDescription: article.excerpt || 'Read the source-attributed music news report.',
        articleContent: article.ai_content,
        isAiGenerated: article.ai_generated === true,
        similarityScore: article.ai_similarity_score || 0,
        similarityCheckPassed: article.ai_status === 'generated',
        retryCount: 0,
      }
    : {
        seoTitle: article.title,
        seoDescription: isLatestNews
          ? `MusicTop is reporting on a music story published by ${sourceName}.`
          : `Official source link from ${sourceName}.`,
        articleContent: article.content || `Open the original report from ${sourceName}.`,
        isAiGenerated: false,
        similarityScore: 0,
        similarityCheckPassed: false,
        retryCount: 0,
      };

  const articleParagraphs = aiArticle.articleContent
    .split(/\n\s*\n/)
    .map((paragraph: string) => paragraph.trim())
    .filter(Boolean);
  const sourceUrl = getSafeSourceUrl(resolvedSource.sourceUrl);
  const pageUrl = getArticlePageUrl(regionName, id);
  const articleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: aiArticle.seoTitle,
    description: aiArticle.seoDescription,
    image: getSafeSourceUrl(article.image) || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    datePublished: article.created_at || undefined,
    dateModified: article.created_at || undefined,
    articleSection: article.category || 'Music News',
    author: {
      '@type': 'Organization',
      name: 'MusicTop Editorial',
      url: 'https://musictop.net',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MusicTop',
      url: 'https://musictop.net',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    citation: sourceUrl || undefined,
    isBasedOn: sourceUrl || undefined,
    sourceOrganization: {
      '@type': 'Organization',
      name: sourceName,
      ...(sourceUrl ? { url: sourceUrl } : {}),
    },
  };

  return (
    <div className="min-h-screen bg-white text-black pt-40 pb-20 font-sans">
      <StructuredData data={articleStructuredData} />
      <div className="max-w-[900px] mx-auto px-6">
        
        {/* NAVIGACIJA NAZAD */}
        <Link 
          href={`/news/${regionName}`} 
          className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-purple-600 mb-12 block transition-colors"
        >
          ← Back to {regionName} News Feed
        </Link>

        {/* CATEGORY & TITLE */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-purple-600 font-black text-xs tracking-[0.4em] uppercase">
            {article.category || 'MUSIC INDUSTRY'}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            SOURCE: {sourceName}
          </span>
        </div>
        <h1 className="text-5xl md:text-8xl font-black leading-[0.9] uppercase tracking-tighter mb-12">
          {aiArticle.seoTitle}
        </h1>

        {/* MAIN IMAGE */}
        <div className="aspect-[16/9] mb-16 overflow-hidden bg-zinc-100 shadow-2xl">
          <img 
            src={article.image || `https://images.unsplash.com/photo-1470225620780-dba8ba36b745`} 
            className="w-full h-full object-cover transition-all duration-1000"
            alt={article.title} 
          />
        </div>

        {/* ARTICLE CONTENT */}
        <div className="max-w-[700px] mx-auto">
          {/* EXCERPT / LEAD PARAGRAPH */}
          <p className="text-2xl md:text-3xl font-bold leading-tight mb-12 border-l-8 border-black pl-8 italic uppercase tracking-tight">
            {aiArticle.seoDescription}
          </p>

          {/* MAIN TEXT */}
          <div className="text-lg md:text-xl text-zinc-800 leading-relaxed uppercase font-medium space-y-8 whitespace-pre-line">
            <p className="text-[10px] not-italic tracking-[0.2em] text-purple-600 font-black uppercase">
              {aiArticle.isAiGenerated ? 'AI-SYNTHESIZED EDITORIAL REPORT' : 'EDITORIAL REWRITE UNAVAILABLE'} · SOURCE: {sourceName}
            </p>
            <div className="space-y-6 normal-case font-normal leading-relaxed">
              {articleParagraphs.map((paragraph: string, index: number) => (
                <p key={`${article.id}-paragraph-${index}`}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* DUGME ZA ORIGINALNI IZVOR (Call to Action) */}
          <div className="mt-20 w-full border-t-[12px] border-black bg-zinc-50 p-6 text-center sm:p-8 md:p-12">
            <h3 className="mb-5 text-sm font-black uppercase tracking-[0.12em] sm:mb-6 sm:tracking-widest">
              Full Story & Global Impact
            </h3>
            <p className="mb-7 text-[10px] font-bold uppercase leading-relaxed text-zinc-500 sm:mb-8 sm:px-4">
              {aiArticle.isAiGenerated
                ? `This article was synthesized and rewritten by MusicTop Editorial from reporting published by ${sourceName}. Read the publisher\'s report for the complete source context.`
                : `The independent rewrite is temporarily unavailable. The publisher\'s article is linked below and is not reproduced on this page.`}
            </p>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Read the original source from ${sourceName}`}
                className="flex min-h-14 w-full items-center justify-center break-words bg-black px-4 py-4 text-[10px] font-black uppercase leading-relaxed tracking-[0.12em] text-white shadow-xl transition-all duration-500 hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-600 sm:py-5 sm:text-xs sm:tracking-[0.2em] md:py-6 md:tracking-[0.3em]"
              >
                Read Original Source: {sourceName}
              </a>
            ) : (
              <p className="flex min-h-14 w-full items-center justify-center break-words bg-zinc-200 px-4 py-4 text-[10px] font-black uppercase leading-relaxed tracking-[0.12em] text-zinc-500 sm:py-5 sm:text-xs sm:tracking-[0.2em] md:py-6 md:tracking-[0.3em]">
                Original source link unavailable · Source: {sourceName}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}