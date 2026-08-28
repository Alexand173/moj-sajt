import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StructuredData from '@/components/StructuredData';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export const dynamic = 'force-dynamic';

interface CommunityNewsProfile {
  first_name?: string | null;
  avatar_url?: string | null;
}

interface CommunityNewsRecord {
  id: string | number;
  title: string;
  content: string | null;
  created_at: string | null;
  region: string | null;
  post_image: string | null;
  author_id: string | null;
  profiles?: CommunityNewsProfile | CommunityNewsProfile[] | null;
}

function getProfile(article: CommunityNewsRecord): CommunityNewsProfile | null {
  return Array.isArray(article.profiles) ? article.profiles[0] || null : article.profiles || null;
}

function getSafeHttpUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getPageUrl(regionName: string, id: string): string {
  return `https://musictop.net/news/${encodeURIComponent(regionName)}/community/${encodeURIComponent(id)}`;
}

async function getCommunityNews(regionName: string, id: string): Promise<CommunityNewsRecord | null> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('community_news')
      .select(`
        id, title, content, created_at, region, post_image, author_id,
        profiles (first_name, avatar_url)
      `)
      .eq('id', id)
      .eq('region', regionName.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;
    return data as CommunityNewsRecord;
  } catch (error) {
    console.warn(`Could not load community news ${id}:`, error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}): Promise<Metadata> {
  const { regionName, id } = await params;
  const article = await getCommunityNews(regionName, id);
  if (!article) return { title: 'Community news' };

  const pageUrl = getPageUrl(regionName, id);
  const imageUrl = getSafeHttpUrl(article.post_image);
  const description = (article.content || `Community news from ${regionName.toUpperCase()}.`).slice(0, 180);

  return {
    title: `${article.title} | Community news`,
    description,
    authors: [{ name: getProfile(article)?.first_name || 'MusicTop community' }],
    alternates: { canonical: pageUrl },
    openGraph: {
      title: article.title,
      description,
      url: pageUrl,
      siteName: 'MusicTop',
      type: 'article',
      publishedTime: article.created_at || undefined,
      images: imageUrl ? [{ url: imageUrl, alt: article.title }] : undefined,
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: article.title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function CommunityNewsArticlePage({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}) {
  const { regionName, id } = await params;
  const article = await getCommunityNews(regionName, id);
  if (!article) notFound();

  const profile = getProfile(article);
  const author = profile?.first_name || 'Anonymous contributor';
  const imageUrl = getSafeHttpUrl(article.post_image);
  const content = article.content?.trim() || 'This community news report does not include additional content.';
  const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const pageUrl = getPageUrl(regionName, id);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: content.slice(0, 180),
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: article.created_at || undefined,
    dateModified: article.created_at || undefined,
    author: { '@type': 'Person', name: author },
    publisher: { '@type': 'Organization', name: 'MusicTop', url: 'https://musictop.net' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    articleSection: 'Community news',
  };

  return (
    <div className="mt-page mt-page--paper pb-20 pt-10">
      <StructuredData data={structuredData} />
      <main className="mt-container">
        <Link href={`/news/${regionName}`} className="mb-10 inline-flex items-center gap-2 border-b border-ink pb-2 text-[10px] font-black tracking-[0.2em] text-ink uppercase transition-colors hover:border-accent-red hover:text-accent-red">
          ← Back to {regionName} news
        </Link>

        <article className="grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
          <div>
            <header className="border-b border-line pb-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-accent-red px-2.5 py-1 text-[9px] font-black tracking-[0.2em] text-white uppercase">Community news</span>
                <span className="mt-meta text-muted">{formatDate(article.created_at)} · {regionName.toUpperCase()}</span>
              </div>
              <h1 className="mt-6 max-w-5xl text-balance text-[clamp(2.5rem,6vw,6.5rem)] font-black leading-[0.88] tracking-[-0.08em] text-ink uppercase">{article.title}</h1>
            </header>

            {imageUrl && (
              <figure className="mt-8 overflow-hidden bg-ink">
                <img src={imageUrl} alt={article.title} loading="eager" fetchPriority="high" decoding="async" className="max-h-[38rem] w-full object-cover grayscale transition-all duration-700 hover:grayscale-0" />
              </figure>
            )}

            <div className="mt-10 border-l-4 border-accent-red pl-5 text-xl font-black leading-tight tracking-[-0.03em] text-muted sm:text-2xl">
              {paragraphs[0]}
            </div>
            {paragraphs.length > 1 && (
              <div className="mt-10 space-y-6 border-t border-line pt-6 text-base leading-relaxed text-ink sm:text-lg">
                {paragraphs.slice(1).map((paragraph, index) => <p key={`${article.id}-paragraph-${index}`}>{paragraph}</p>)}
              </div>
            )}
          </div>

          <aside className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6">
            <p className="mt-meta text-muted">Published by</p>
            <div className="mt-4 flex items-center gap-3">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" loading="lazy" decoding="async" className="size-12 rounded-full border border-line object-cover" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-ink text-[10px] font-black text-white">MT</span>
              )}
              <div>
                <p className="text-sm font-black tracking-[0.08em] text-ink uppercase">{author}</p>
                <p className="mt-1 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">MusicTop community</p>
              </div>
            </div>
            <div className="mt-8 border-t border-line pt-5">
              <p className="mt-meta text-muted">Region</p>
              <p className="mt-3 text-sm font-black tracking-[0.14em] text-ink uppercase">{regionName}</p>
            </div>
            <div className="mt-8 border-t border-line pt-5">
              <p className="mt-meta text-muted">Story type</p>
              <p className="mt-3 text-sm font-black tracking-[0.08em] text-ink uppercase">Reader publication</p>
            </div>
          </aside>
        </article>
      </main>
    </div>
  );
}
