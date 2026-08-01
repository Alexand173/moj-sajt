import { notFound } from 'next/navigation';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import type { ChartSong } from '@/lib/chart-types';
import type { Metadata } from 'next';
import SongCard from '@/components/SongCard';
import SuggestionSection from '@/components/SuggestionSection';
import AdSenseBanner from '@/components/AdSenseBanner';
import SuggestionScrollBadge from '@/components/SuggestionScrollBadge';
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
    alternates: {
      canonical: canonicalPath,
    },
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

  if (!songs || songs.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pt-44 px-10 text-center">
        <div className="py-20 text-zinc-600 uppercase text-sm border border-white/5 rounded-[2.5rem] bg-white/[0.01]">
          No tracks found for {normalizedRegion.toUpperCase()} {normalizedGenre.toUpperCase()} yet.
        </div>
      </div>
    );
  }

  const region = normalizedRegion.toUpperCase();
  const genre = normalizedGenre.replace('-', '');
  const adKey = `${region}_${genre}`;

  const adSlots: Record<string, { top: string; mid1: string; mid2: string; mid3: string; bottom: string }> = {
    US_rock: {
      top: '5000000001',
      mid1: '5000000002',
      mid2: '5000000003',
      mid3: '5000000004',
      bottom: '5000000005',
    },
    US_pop: {
      top: '5100000001',
      mid1: '5100000002',
      mid2: '5100000003',
      mid3: '5100000004',
      bottom: '5100000005',
    },
    EUROPA_rock: {
      top: '6000000001',
      mid1: '6000000002',
      mid2: '6000000003',
      mid3: '6000000004',
      bottom: '6000000005',
    },
    DEFAULT: {
      top: '0000000001',
      mid1: '0000000002',
      mid2: '0000000003',
      mid3: '0000000004',
      bottom: '0000000005',
    },
  };

  const currentAdSlots = adSlots[adKey] || adSlots.DEFAULT;
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${region} ${normalizedGenre.toUpperCase()} Top 100`,
    description: `Top 100 ${normalizedGenre} songs in ${region}`,
    itemListElement: songs.slice(0, 10).map((song, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: song.title,
      url: canonicalPath,
    })),
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden selection:bg-purple-500">
      <StructuredData data={itemListSchema} />
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-900/5 blur-[150px] rounded-full animate-pulse" />
      </div>

      <section className="pt-44 pb-8 px-10 relative max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-10 w-full">
          <div className="w-full lg:max-w-[500px] shrink-0">
            <div className="flex items-center gap-3 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] font-black tracking-[0.5em] text-zinc-400 uppercase">
                {normalizedRegion} {normalizedGenre} • Live Chart 2026
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent uppercase select-none">
              {normalizedRegion} {normalizedGenre} <br />
              <span className="text-purple-500">Top {songs.length}</span>
            </h1>
          </div>
        </div>
      </section>

      <main className="max-w-[1600px] mx-auto px-10 pb-40 space-y-16">
        {songs[0] && (
          <div className="w-full">
            <SongCard song={songs[0]} rank={1} variant="big" />
          </div>
        )}

        {(songs[1] || songs[2]) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {songs.slice(1, 3).map((song, index) => (
              <SongCard key={song.id} song={song} rank={index + 2} variant="medium" />
            ))}
          </div>
        )}

        <div className="py-8">
          <AdSenseBanner adSlot={currentAdSlots.top} />
        </div>

        {songs.length > 3 && (
          <div className="pt-20 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {songs.slice(3).map((song, index) => {
                const currentRank = index + 4;

                return (
                  <div key={song.id} className="contents">
                    <SongCard song={song} rank={currentRank} variant="standard" />

                    {currentRank === 25 && (
                      <div className="col-span-full py-4">
                        <AdSenseBanner adSlot={currentAdSlots.mid1} />
                      </div>
                    )}

                    {currentRank === 50 && (
                      <div className="col-span-full py-4">
                        <AdSenseBanner adSlot={currentAdSlots.mid2} />
                      </div>
                    )}

                    {currentRank === 75 && (
                      <div className="col-span-full py-4">
                        <AdSenseBanner adSlot={currentAdSlots.mid3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-12">
          <AdSenseBanner adSlot={currentAdSlots.bottom} />
        </div>

        <div id="suggestions-section" className="w-full pt-20 pb-20 border-t border-white/10">
          <div className="max-w-4xl mx-auto">
            <SuggestionSection
              regionName={normalizedRegion}
              genreId={genreId}
              genreName={normalizedGenre}
            />
          </div>
        </div>
      </main>

      <SuggestionScrollBadge />
    </div>
  );
}
