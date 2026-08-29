import { Fragment, cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StructuredData from '@/components/StructuredData';
import { getNewsSourceName } from '@/lib/ai-news';
import { findFreshYouTubeMedia, findRecentNewsImages, type RelatedNewsImage as RelatedNewsImageData, type RelatedNewsMedia } from '@/lib/news-media';
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

function formatMediaDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'RECENTLY';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function formatViewCount(value: number) {
  return `${value.toLocaleString('en-US')} views`;
}

function RelatedNewsVideo({ media }: { media: RelatedNewsMedia }) {
  const headingId = `related-video-${media.videoId}`;

  return (
    <section aria-labelledby={headingId} className="my-10 border-y border-line py-5 sm:my-12 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mt-meta text-accent-red">Recent video</p>
          <h2 id={headingId} className="mt-3 text-xl font-black leading-tight tracking-[-0.04em] text-ink uppercase sm:text-2xl">{media.videoTitle}</h2>
          <p className="mt-2 text-[10px] font-bold tracking-[0.12em] text-muted uppercase">{media.channelTitle} · Published {formatMediaDate(media.publishedAt)} · {formatViewCount(media.viewCount)}</p>
        </div>
        <a href={media.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-red">
          Watch on YouTube <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="mt-5 aspect-video overflow-hidden bg-ink">
        <iframe
          src={media.embedUrl}
          title={`${media.videoTitle} — YouTube video`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </section>
  );
}

function RelatedNewsImage({ image, captionId }: { image?: RelatedNewsImageData | null; captionId: string }) {
  if (!image) return null;

  return (
    <figure aria-labelledby={captionId} className="my-10 border border-line bg-paper-muted p-4 sm:my-12 sm:p-6">
      <div className="aspect-[16/9] overflow-hidden bg-ink">
        <img src={image.src} alt={image.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
      <figcaption id={captionId} className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">
        <span>{image.caption}</span>
        {image.publishedAt && <span>{formatMediaDate(image.publishedAt)}</span>}
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
  const shouldInsertRelatedMedia = article.category === 'LATEST' && hasValidatedRewrite && articleParagraphs.length > 5;
  const relatedMedia = shouldInsertRelatedMedia
    ? await findFreshYouTubeMedia({ title: article.title, excerpt: article.excerpt })
    : null;
  const relatedImages = shouldInsertRelatedMedia
    ? await findRecentNewsImages({
        title: article.title,
        excerpt: article.excerpt,
        excludedUrls: [article.image, relatedMedia?.thumbnailUrl],
      })
    : [];
  const fallbackRelatedImage: RelatedNewsImageData | null = shouldInsertRelatedMedia && article.image
    ? {
        src: article.image,
        alt: `Fresh image related to ${article.title}`,
        caption: 'Story image',
      }
    : null;
  const relatedImageAfterThird = shouldInsertRelatedMedia && !relatedMedia
    ? relatedImages[0] || fallbackRelatedImage
    : null;
  const relatedImageAfterSixth = shouldInsertRelatedMedia
    ? relatedMedia
      ? relatedImages[0] || fallbackRelatedImage
      : relatedImages[1] || (relatedImages[0] ? fallbackRelatedImage : null)
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
  const relatedVideoStructuredData = relatedMedia
    ? createVideoObjectSchema({
        name: relatedMedia.videoTitle,
        description: `A recent video related to ${relatedMedia.subjectQuery}.`,
        videoId: relatedMedia.videoId,
        pageUrl,
        thumbnailUrl: relatedMedia.thumbnailUrl,
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
            <div className="mt-10 border-t border-line pt-5">{!aiArticle.isAiGenerated && <p className="mt-meta text-accent-red">Editorial source report · {sourceName}</p>}<div className="mt-7 space-y-6 text-base leading-relaxed text-ink sm:text-lg">{articleParagraphs.map((paragraph, index) => <Fragment key={`${article.id}-paragraph-${index}`}><p>{paragraph}</p>{index === 2 && (relatedMedia ? <RelatedNewsVideo media={relatedMedia} /> : <RelatedNewsImage image={relatedImageAfterThird} captionId="related-image-after-third" />)}{index === 5 && <RelatedNewsImage image={relatedImageAfterSixth} captionId="related-image-after-sixth" />}</Fragment>)}</div></div>

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
