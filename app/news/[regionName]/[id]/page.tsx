import { Fragment, cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StructuredData from '@/components/StructuredData';
import { getNewsSourceName } from '@/lib/ai-news';
import { getMediaIdentity, getSafeMediaUrl, getStoredNewsMediaUrl, getYouTubeEmbedUrl, getYouTubeVideoId, isLikelyEditorialImageUrl } from '@/lib/news-media';
import { countWords, hasValidatedAiContent } from '@/lib/news-indexability';
import { createBreadcrumbListSchema, createVideoObjectSchema } from '@/lib/seo-schema';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

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
  layout1: string | null;
  layout2: string | null;
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
    const { data, error } = await supabase.from('news').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as NewsArticleRecord;
  } catch (error) {
    console.warn(`Could not load news article ${id}:`, error);
    return null;
  }
});

const getResolvedSource = cache(async (article: NewsArticleRecord) => {
  const sourceUrl = getSafeSourceUrl(article.url);
  return {
    sourceUrl,
    sourceName: getNewsSourceName(sourceUrl),
    sourceArticleText: '',
    excerpt: article.excerpt?.trim() || '',
  };
});


function RelatedNewsVideo({ videoUrl }: { videoUrl: string }) {
  const videoId = getYouTubeVideoId(videoUrl);
  if (!videoId) return null;

  const headingId = `related-video-${videoId}`;

  return (
    <section aria-labelledby={headingId} className="my-10 border-y border-line py-5 sm:my-12 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mt-meta text-accent-red">Recent video</p>
          <h2 id={headingId} className="mt-3 text-xl font-black leading-tight tracking-[-0.04em] text-ink uppercase sm:text-2xl">Related music video</h2>
          <p className="mt-2 text-[10px] font-bold tracking-[0.12em] text-muted uppercase">Selected for this story · Published within the last two years</p>
        </div>
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-red">
          Watch on YouTube <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="mt-5 aspect-video overflow-hidden bg-ink">
        <iframe
          src={getYouTubeEmbedUrl(videoId)}
          title="Related music video — YouTube video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </section>
  );
}

function RelatedNewsImage({ imageUrl, captionId }: { imageUrl?: string | null; captionId: string }) {
  const safeImageUrl = getSafeMediaUrl(imageUrl);
  if (!safeImageUrl || !isLikelyEditorialImageUrl(safeImageUrl)) return null;

  const imageProvider = safeImageUrl.includes('wikimedia.org') ? 'Wikimedia Commons' : 'Google Images';

  return (
    <figure aria-labelledby={captionId} className="my-10 border border-line bg-paper-muted p-4 sm:my-12 sm:p-6">
      <div className="aspect-[16/9] overflow-hidden bg-ink">
        <img src={safeImageUrl} alt="Recent image related to this news story" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
      <figcaption id={captionId} className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">
        <span>Related subject image · {imageProvider}</span>
        <span>Distinct from the headline image</span>
      </figcaption>
    </figure>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}): Promise<Metadata> {
  const { id, regionName } = await params;
  const pageUrl = getArticlePageUrl(regionName, id);
  const article = await getNewsArticle(id);

  if (!article) notFound();

  const resolvedSource = await getResolvedSource(article);
  const sourceName = resolvedSource.sourceName;
  const description = `Source-attributed MusicTop reporting based on reporting by ${sourceName}. ${article.excerpt || 'Read the source-attributed music news report.'}`.slice(0, 180);
  const imageUrl = getSafeSourceUrl(article.image);
  const sourceUrl = getSafeSourceUrl(resolvedSource.sourceUrl);
  const isIndexable = hasValidatedAiContent(article);

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
    twitter: { card: 'summary_large_image', title: article.title, description, images: imageUrl ? [imageUrl] : undefined },
    robots: isIndexable ? undefined : { index: false, follow: true },
    other: {
      'article:source': sourceName,
      ...(sourceUrl ? { 'article:source_url': sourceUrl } : {}),
      'article:content_origin': article.category === 'LATEST' ? 'AI-synthesized report based on source reporting' : 'Official publisher link',
    },
  };
}

export default async function SingleNewsPage({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}) {
  const { id, regionName } = await params;
  const article = await getNewsArticle(id);

  if (!article) notFound();

  const resolvedSource = await getResolvedSource(article);
  const sourceName = resolvedSource.sourceName;
  const isLatestNews = article.category === 'LATEST';
  const hasValidatedRewrite = hasValidatedAiContent(article);
  const aiArticle = hasValidatedRewrite
    ? {
        seoTitle: article.title,
        seoDescription: article.excerpt || 'Read the source-attributed music news report.',
        articleContent: article.ai_content!.trim(),
        isAiGenerated: true,
        similarityScore: article.ai_similarity_score || 0,
        similarityCheckPassed: true,
        retryCount: 0,
      }
    : {
        seoTitle: article.title,
        seoDescription: isLatestNews ? `MusicTop is reporting on a music story published by ${sourceName}.` : `Official source link from ${sourceName}.`,
        articleContent: `MusicTop could not complete an independent editorial rewrite of this report from ${sourceName}.\n\nThe original publisher's report is available through the source link below. This page does not reproduce that article while the editorial rewrite is unavailable.`,
        isAiGenerated: false,
        similarityScore: article.ai_similarity_score || 0,
        similarityCheckPassed: false,
        retryCount: 0,
      };

  const articleParagraphs = aiArticle.articleContent.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const canRenderStoredMedia = article.category === 'LATEST' && hasValidatedRewrite && articleParagraphs.length >= 3;
  const headlineImageUrl = canRenderStoredMedia ? getSafeMediaUrl(article.image) : null;
  const headlineImageIdentity = headlineImageUrl ? getMediaIdentity(headlineImageUrl) : null;
  const storedLayout1 = canRenderStoredMedia ? getStoredNewsMediaUrl(article.layout1) : null;
  const storedLayout2 = canRenderStoredMedia && isLikelyEditorialImageUrl(article.layout2)
    ? getSafeMediaUrl(article.layout2)
    : null;
  const storedLayout1Identity = storedLayout1 ? getMediaIdentity(storedLayout1) : null;
  const relatedVideoId = getYouTubeVideoId(storedLayout1);
  const relatedVideoUrl = relatedVideoId ? storedLayout1 : null;
  const relatedImageAfterThird = relatedVideoUrl || storedLayout1Identity === headlineImageIdentity ? null : storedLayout1;
  const relatedImageAfterSixth = articleParagraphs.length >= 6 && storedLayout2
    && getMediaIdentity(storedLayout2) !== storedLayout1Identity
    && getMediaIdentity(storedLayout2) !== headlineImageIdentity
    ? storedLayout2
    : null;
  const sourceUrl = getSafeSourceUrl(resolvedSource.sourceUrl);
  const pageUrl = getArticlePageUrl(regionName, id);
  const breadcrumbSchema = createBreadcrumbListSchema([
    { name: 'Home', url: '/' },
    { name: `${regionName.toUpperCase()} News`, url: `/news/${encodeURIComponent(regionName)}` },
    { name: article.title, url: pageUrl },
  ]);
  const articleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: aiArticle.seoTitle,
    description: aiArticle.seoDescription,
    image: getSafeSourceUrl(article.image) || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    datePublished: article.created_at || undefined,
    dateModified: article.created_at || undefined,
    articleSection: article.category || 'Music News',
    author: { '@type': 'Organization', name: 'MusicTop Editorial', url: 'https://musictop.net' },
    publisher: { '@type': 'Organization', name: 'MusicTop', url: 'https://musictop.net' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    citation: sourceUrl || undefined,
    isBasedOn: sourceUrl || undefined,
    sourceOrganization: { '@type': 'Organization', name: sourceName, ...(sourceUrl ? { url: sourceUrl } : {}) },
    articleBody: hasValidatedRewrite ? aiArticle.articleContent : undefined,
    wordCount: hasValidatedRewrite ? countWords(aiArticle.articleContent) : undefined,
  };
  const relatedVideoStructuredData = relatedVideoId && relatedVideoUrl
    ? createVideoObjectSchema({
        name: 'Related music video',
        description: `A recent YouTube video related to ${article.title}.`,
        videoId: relatedVideoId,
        pageUrl,
        thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(relatedVideoId)}/hqdefault.jpg`,
      })
    : null;

  return (
    <div className="mt-page mt-page--paper pb-20 pt-10">
      {hasValidatedRewrite && <StructuredData data={articleStructuredData} />}
      {relatedVideoStructuredData && <StructuredData data={relatedVideoStructuredData} />}
      <StructuredData data={breadcrumbSchema} />
      <article className="mt-container">
        <Link href={`/news/${regionName}`} className="mb-12 inline-flex items-center gap-2 border-b border-ink pb-2 text-[10px] font-black tracking-[0.22em] text-ink uppercase transition-colors hover:border-accent-red hover:text-accent-red">← Back to {regionName} news feed</Link>

        <header className="border-b border-line pb-10">
          <div className="flex flex-wrap items-center gap-3"><span className="bg-accent-red px-2.5 py-1 text-[9px] font-black tracking-[0.2em] text-white uppercase">{article.category || 'Music industry'}</span><span className="mt-meta text-muted">Source: {sourceName}</span></div>
          <h1 className="mt-6 max-w-6xl text-balance text-[clamp(3.25rem,8vw,8rem)] font-black leading-[0.85] tracking-[-0.08em] text-ink uppercase">{aiArticle.seoTitle}</h1>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">Published {article.created_at ? new Date(article.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'recently'} · {regionName.toUpperCase()}</p>
        </header>

        {article.image && <div className="mt-10 aspect-[16/8] overflow-hidden bg-ink"><img src={article.image} alt={article.title} loading="eager" fetchPriority="high" decoding="async" className="news-feed-image h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0" /></div>}

        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16">
          <div>
            <p className="border-l-4 border-accent-red pl-6 text-2xl font-black leading-[0.98] tracking-[-0.04em] text-muted sm:text-3xl">{aiArticle.seoDescription}</p>
            <div className="mt-10 border-t border-line pt-5">
              {!aiArticle.isAiGenerated && <p className="mt-meta text-accent-red">Editorial source report · {sourceName}</p>}
              <div className="mt-7 space-y-6 text-base leading-relaxed text-ink sm:text-lg">
                {articleParagraphs.map((paragraph, index) => (
                  <Fragment key={`${article.id}-paragraph-${index}`}>
                    <p>{paragraph}</p>
                    {index === 2 && relatedVideoUrl && <RelatedNewsVideo videoUrl={relatedVideoUrl} />}
                    {index === 2 && !relatedVideoUrl && <RelatedNewsImage imageUrl={relatedImageAfterThird} captionId="related-image-after-third" />}
                    {index === 5 && <RelatedNewsImage imageUrl={relatedImageAfterSixth} captionId="related-image-after-sixth" />}
                  </Fragment>
                ))}
              </div>
            </div>

            <section className="mt-16 border-t-8 border-ink bg-paper-muted p-6 sm:p-10">
              <h2 className="text-xl font-black tracking-[-0.04em] text-ink uppercase sm:text-2xl">Full story & global impact</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">{aiArticle.isAiGenerated ? `This article was synthesized and rewritten by MusicTop Editorial from reporting published by ${sourceName}. Read the publisher's report for the complete source context.` : `The independent rewrite is temporarily unavailable. The publisher's article is linked below and is not reproduced on this page.`}</p>
              {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Read the original source from ${sourceName}`} className="mt-7 flex min-h-14 items-center justify-center gap-2 bg-ink px-4 py-4 text-center text-[10px] font-black tracking-[0.16em] text-white uppercase transition-colors hover:bg-accent-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-red">Read original source: {sourceName} <span aria-hidden="true">↗</span></a> : <p className="mt-7 bg-line px-4 py-4 text-center text-[10px] font-black tracking-[0.16em] text-muted uppercase">Original source link unavailable · Source: {sourceName}</p>}
            </section>
          </div>
          <aside className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6"><p className="mt-meta text-muted">Filed under</p><p className="mt-3 text-xl font-black tracking-[-0.04em] text-ink uppercase">{article.category || 'Music news'}</p><div className="mt-8 border-t border-line pt-5"><p className="mt-meta text-muted">Region</p><p className="mt-3 text-sm font-black tracking-[0.14em] text-ink uppercase">{regionName}</p></div></aside>
        </div>
      </article>
    </div>
  );
}
