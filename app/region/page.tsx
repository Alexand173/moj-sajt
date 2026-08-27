import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import type { ChartSong } from '@/lib/chart-types';
import ChartPageView from '@/components/ChartPageView';
import StructuredData from '@/components/StructuredData';

const GENRE_MAP: Record<string, number> = {
  rock: 1,
  pop: 2,
  'hip-hop': 3,
  'rb-soul': 4,
  country: 5,
  'dance-electronic': 6,
  'j-pop': 7,
  'j-rock-metal': 8,
  'k-pop': 9,
  'c-pop': 10,
  india: 11,
  other: 12,
  jazz: 13,
  classical: 14,
  metal: 15,
};

export async function generateMetadata(): Promise<Metadata> {
  const regionName = 'us';
  const genreName = 'rock';
  const genreNameFormatted = genreName.charAt(0).toUpperCase() + genreName.slice(1);
  const region = regionName.toUpperCase();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const title = `Best ${genreNameFormatted} Songs in ${region} - Top 100 Chart ${currentMonth} ${currentYear}`;
  const description = `Discover the best ${genreNameFormatted} music in ${region}. Official audience-ranked top 100 chart featuring the most popular ${genreNameFormatted} tracks. Updated daily for ${currentMonth} ${currentYear}.`;

  return {
    title,
    description,
    alternates: { canonical: 'https://musictop.net' },
    openGraph: {
      title: `${region} ${genreNameFormatted} Top 100 | MUSIC TOP`,
      description: `Vote and follow the official ${genreNameFormatted} music chart in ${region}.`,
      url: 'https://musictop.net',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function HomePage() {
  const regionName = 'us';
  const genreName = 'rock';
  const genreId = GENRE_MAP[genreName];
  if (!genreId) return notFound();

  const supabase = getPublicSupabaseClient();
  let songs: ChartSong[] | null = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('region', regionName.toUpperCase())
        .eq('genre_id', genreId)
        .order('viewers', { ascending: false })
        .limit(200);
      songs = (data || []) as ChartSong[];
    } catch (error) {
      console.warn('Could not load the homepage chart:', error);
    }
  }

  const chartSongs = songs || [];
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${regionName.toUpperCase()} ${genreName.toUpperCase()} Top 100`,
    description: `Top 100 ${genreName} songs in ${regionName.toUpperCase()}`,
    itemListElement: chartSongs.slice(0, 10).map((song, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: song.title,
      url: 'https://musictop.net',
    })),
  };

  return (
    <>
      <StructuredData data={itemListSchema} />
      <ChartPageView
        songs={chartSongs}
        regionName={regionName}
        genreName={genreName}
        genreId={genreId}
        canonicalPath="https://musictop.net"
      />
    </>
  );
}
