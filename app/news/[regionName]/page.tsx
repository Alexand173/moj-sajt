import { unstable_noStore as noStore } from 'next/cache';
import type { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import NewsEditorialView, { type NewsEditorialItem } from '@/components/NewsEditorialView';

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
  let communityNews: NewsEditorialItem[] = [];
  let communityPosts: NewsEditorialItem[] = [];
  let discussions: NewsEditorialItem[] = [];
  let concertAlbums: NewsEditorialItem[] = [];

  if (supabase) {
    try {
      const [officialRes, latestRes, communityNewsRes, blogRes, discRes, concertRes] = await Promise.all([
        supabase.from('news').select('*').eq('region', region).eq('category', 'OFFICIAL').order('created_at', { ascending: false }).limit(50),
        supabase.from('news').select('*').eq('region', region).eq('category', 'LATEST').order('created_at', { ascending: false }).limit(50),
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
      communityNews = (communityNewsRes.data || []) as NewsEditorialItem[];
      communityPosts = (blogRes.data || []) as NewsEditorialItem[];
      discussions = (discRes.data || []) as NewsEditorialItem[];
      concertAlbums = (concertRes.data || []) as NewsEditorialItem[];
    } catch (error) {
      console.warn(`Could not load the ${region} news feed:`, error);
    }
  }

  const activeBlog = blogId ? communityPosts.find((post) => post.id.toString() === blogId) : null;
  const activeAlbum = albumId ? concertAlbums.find((album) => album.id.toString() === albumId) : null;

  return (
    <NewsEditorialView
      region={region}
      featuredNews={latestNews[0]}
      latestNews={latestNews}
      communityNews={communityNews}
      officialNews={officialNews}
      communityPosts={communityPosts}
      discussions={discussions}
      concertAlbums={concertAlbums}
      activeBlog={activeBlog}
      activeAlbum={activeAlbum}
    />
  );
}
