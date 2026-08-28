import { unstable_noStore as noStore } from 'next/cache';
import type { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import NewsEditorialView, { type NewsEditorialItem } from '@/components/NewsEditorialView';

const MOST_READ_LIMIT = 5;
const NEWS_FEED_LIMIT = 50;
const STORIES_BY_MASS_LIMIT = 4;
const STORIES_BY_MASS_OFFSET = NEWS_FEED_LIMIT;
const STORIES_BY_MASS_FETCH_LIMIT = 50;

function getNewsTitle(item: NewsEditorialItem) {
  return item.title?.trim() || item.text?.trim() || '';
}

function normalizeNewsTitle(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function buildMostReadNews(latestNews: NewsEditorialItem[], officialNews: NewsEditorialItem[]) {
  const selected: NewsEditorialItem[] = [];
  const seenIds = new Set<string>();
  const maxSourceLength = Math.max(latestNews.length, officialNews.length);

  for (let index = 0; index < maxSourceLength && selected.length < MOST_READ_LIMIT; index += 1) {
    for (const item of [latestNews[index], officialNews[index]]) {
      if (!item) continue;

      const title = getNewsTitle(item);
      const itemId = String(item.id);
      if (!title || seenIds.has(itemId)) continue;

      seenIds.add(itemId);
      selected.push(item);
      if (selected.length === MOST_READ_LIMIT) break;
    }
  }

  return selected;
}

function buildStoriesByMass(
  latestNews: NewsEditorialItem[],
  officialNews: NewsEditorialItem[],
  additionalLatestNews: NewsEditorialItem[],
  additionalOfficialNews: NewsEditorialItem[],
) {
  const displayedNews = [...latestNews, ...officialNews];
  const excludedIds = new Set(displayedNews.map((item) => String(item.id)));
  const excludedTitles = new Set(
    displayedNews
      .map(getNewsTitle)
      .map(normalizeNewsTitle)
      .filter(Boolean),
  );
  const selected: NewsEditorialItem[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  for (const item of [...additionalLatestNews, ...additionalOfficialNews]) {
    const title = getNewsTitle(item);
    const normalizedTitle = normalizeNewsTitle(title);
    const itemId = String(item.id);
    if (
      !title
      || excludedIds.has(itemId)
      || excludedTitles.has(normalizedTitle)
      || seenIds.has(itemId)
      || seenTitles.has(normalizedTitle)
    ) continue;

    seenIds.add(itemId);
    seenTitles.add(normalizedTitle);
    selected.push(item);
    if (selected.length === STORIES_BY_MASS_LIMIT) break;
  }

  return selected;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regionName: string }>;
}): Promise<Metadata> {
  const { regionName } = await params;
  const region = regionName.toLowerCase();
  const canonical = `/news/${encodeURIComponent(region)}`;

  return {
    title: `${region.toUpperCase()} Music News`,
    description: `Read the latest official, community, and concert news from ${region.toUpperCase()} on MusicTop.`,
    alternates: { canonical },
    openGraph: {
      title: `${region.toUpperCase()} Music News | MusicTop`,
      description: `Read the latest music news from ${region.toUpperCase()} on MusicTop.`,
      url: canonical,
      type: 'website',
    },
  };
}

export default async function BillboardNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ regionName: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  noStore();
  const { regionName } = await params;
  const { blogId, albumId } = await searchParams;
  const region = regionName.toLowerCase();
  const supabase = getPublicSupabaseClient();

  let officialNews: NewsEditorialItem[] = [];
  let latestNews: NewsEditorialItem[] = [];
  let additionalOfficialNews: NewsEditorialItem[] = [];
  let additionalLatestNews: NewsEditorialItem[] = [];
  let communityNews: NewsEditorialItem[] = [];
  let communityPosts: NewsEditorialItem[] = [];
  let discussions: NewsEditorialItem[] = [];
  let concertAlbums: NewsEditorialItem[] = [];

  if (supabase) {
    try {
      const [officialRes, latestRes, additionalOfficialRes, additionalLatestRes, communityNewsRes, blogRes, discRes, concertRes] = await Promise.all([
        supabase.from('news').select('*').eq('region', region).eq('category', 'OFFICIAL').order('created_at', { ascending: false }).limit(NEWS_FEED_LIMIT),
        supabase.from('news').select('*').eq('region', region).eq('category', 'LATEST').order('created_at', { ascending: false }).limit(NEWS_FEED_LIMIT),
        supabase.from('news').select('*').eq('region', region).eq('category', 'OFFICIAL').order('created_at', { ascending: false }).range(STORIES_BY_MASS_OFFSET, STORIES_BY_MASS_OFFSET + STORIES_BY_MASS_FETCH_LIMIT - 1),
        supabase.from('news').select('*').eq('region', region).eq('category', 'LATEST').order('created_at', { ascending: false }).range(STORIES_BY_MASS_OFFSET, STORIES_BY_MASS_OFFSET + STORIES_BY_MASS_FETCH_LIMIT - 1),
        supabase.from('community_news').select(`
          id, title, content, created_at, region, post_image, author_id,
          profiles (first_name, avatar_url)
        `).eq('region', region).order('created_at', { ascending: false }).limit(50),
        supabase.from('community_posts').select(`
          id, title, content, created_at, region, post_image, author_id,
          profiles (first_name, avatar_url)
        `).eq('region', region).order('created_at', { ascending: false }).limit(3),
        supabase.from('discussions').select('*').eq('region', region).order('created_at', { ascending: false }).limit(3),
        supabase.from('concert_albums').select(`
          id, album_name, created_at, region, images, author_id,
          profiles (first_name, avatar_url)
        `).eq('region', region).order('created_at', { ascending: false }).limit(4),
      ]);

      officialNews = (officialRes.data || []) as NewsEditorialItem[];
      latestNews = (latestRes.data || []) as NewsEditorialItem[];
      additionalOfficialNews = (additionalOfficialRes.data || []) as NewsEditorialItem[];
      additionalLatestNews = (additionalLatestRes.data || []) as NewsEditorialItem[];
      communityNews = (communityNewsRes.data || []) as NewsEditorialItem[];
      communityPosts = (blogRes.data || []) as NewsEditorialItem[];
      discussions = (discRes.data || []) as NewsEditorialItem[];
      concertAlbums = (concertRes.data || []) as NewsEditorialItem[];
    } catch (error) {
      console.warn(`Could not load the ${region} news feed:`, error);
    }
  }

  const mostReadNews = buildMostReadNews(latestNews, officialNews);
  const storiesByMass = buildStoriesByMass(latestNews, officialNews, additionalLatestNews, additionalOfficialNews);
  const activeBlog = blogId ? communityPosts.find((post) => post.id.toString() === blogId) : null;
  const activeAlbum = albumId ? concertAlbums.find((album) => album.id.toString() === albumId) : null;

  return (
    <NewsEditorialView
      region={region}
      featuredNews={latestNews[0]}
      latestNews={latestNews}
      communityNews={communityNews}
      officialNews={officialNews}
      mostReadNews={mostReadNews}
      storiesByMass={storiesByMass}
      communityPosts={communityPosts}
      discussions={discussions}
      concertAlbums={concertAlbums}
      activeBlog={activeBlog}
      activeAlbum={activeAlbum}
    />
  );
}
