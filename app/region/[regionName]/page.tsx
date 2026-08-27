import RegionalClientContent, { type RegionalSong } from '@/components/RegionalClientContent';
import StructuredData from '@/components/StructuredData';
import { createVideoObjectSchema } from '@/lib/seo-schema';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export default async function RegionalPage({ params }: { params: Promise<{ regionName: string }> }) {
  const { regionName } = await params;
  const region = regionName.toUpperCase();

  // Supabase klijent sa procesnim varijablama
  const supabase = getPublicSupabaseClient();
  let songs: RegionalSong[] | null = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('region', region)
        .order('viewers', { ascending: false })
        .limit(200);
      songs = (data || []) as RegionalSong[];
    } catch (error) {
      console.warn(`Could not load the ${region} regional chart:`, error);
    }
  }

  const videoSchemas = (songs || [])
    .filter((song) => song.youtube_id)
    .slice(0, 3)
    .map((song) => createVideoObjectSchema({
      name: `${song.title} by ${song.artist_name}`,
      description: `Official music video for ${song.title} by ${song.artist_name}.`,
      videoId: song.youtube_id!,
      pageUrl: `/region/${encodeURIComponent(regionName.toLowerCase())}`,
    }));

  return (
    <>
      {videoSchemas.map((schema, index) => <StructuredData key={`video-schema-${index}`} data={schema} />)}
      <RegionalClientContent initialSongs={songs || []} region={region} />
    </>
  );
}