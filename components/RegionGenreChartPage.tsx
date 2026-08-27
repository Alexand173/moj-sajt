import { notFound } from 'next/navigation';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import type { ChartSong } from '@/lib/chart-types';
import type { Metadata } from 'next';
import ChartPageView from '@/components/ChartPageView';
import StructuredData from '@/components/StructuredData';

export const GENRE_MAP: Record<string, number> = {
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

type RegionGenreMetadataOptions = {
  regionName: string;
  genreName: string;
  canonicalPath: string;
};

export async function getRegionGenreMetadata({
  regionName,
  genreName,
  canonicalPath,
}: RegionGenreMetadataOptions): Promise<Metadata> {
  const genreNameFormatted = genreName.charAt(0).toUpperCase() + genreName.slice(1);
  const regionRaw = regionName.toUpperCase();
  const region = regionRaw === 'US' || regionRaw === 'UK'
    ? regionRaw
    : regionRaw.charAt(0).toUpperCase() + regionRaw.slice(1).toLowerCase();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const title = `Best ${genreNameFormatted} Songs in ${region} - Top 100 Chart ${currentMonth} ${currentYear}`;
  const description = `Discover the best ${genreNameFormatted} music in ${region}. Official audience-ranked top 100 chart featuring the most popular ${genreNameFormatted} tracks. Updated daily for ${currentMonth} ${currentYear}.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `${region} ${genreNameFormatted} Top 100 | MUSIC TOP`,
      description: `Vote and follow the official ${genreNameFormatted} music chart in ${region}.`,
      url: canonicalPath,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

type RegionGenreChartPageProps = RegionGenreMetadataOptions;

export async function RegionGenreChartPage({
  regionName,
  genreName,
  canonicalPath,
}: RegionGenreChartPageProps) {
  const normalizedRegion = regionName.toLowerCase();
  const normalizedGenre = genreName.toLowerCase();
  const genreId = GENRE_MAP[normalizedGenre];

  if (!genreId) return notFound();

  const supabase = getPublicSupabaseClient();
  let songs: ChartSong[] | null = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('region', normalizedRegion.toUpperCase())
        .eq('genre_id', genreId)
        .order('viewers', { ascending: false })
        .limit(200);
      songs = (data || []) as ChartSong[];
    } catch (error) {
      console.warn(`Could not load the ${normalizedRegion} ${normalizedGenre} chart:`, error);
    }
  }

  const chartSongs = songs || [];
  const region = normalizedRegion.toUpperCase();
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${region} ${normalizedGenre.toUpperCase()} Top 100`,
    description: `Top 100 ${normalizedGenre} songs in ${region}`,
    itemListElement: chartSongs.slice(0, 10).map((song, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: song.title,
      url: canonicalPath,
    })),
  };

  return (
    <>
      <StructuredData data={itemListSchema} />
      <ChartPageView
        songs={chartSongs}
        regionName={normalizedRegion}
        genreName={normalizedGenre}
        genreId={genreId}
        canonicalPath={canonicalPath}
      />
    </>
  );
}
