import RegionalClientContent from '@/components/RegionalClientContent';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export default async function RegionalPage({ params }: { params: Promise<{ regionName: string }> }) {
  const { regionName } = await params;
  const region = regionName.toUpperCase();

  // Supabase klijent sa procesnim varijablama
  const supabase = getPublicSupabaseClient();
  let songs: Array<Record<string, unknown>> | null = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('region', region)
        .order('viewers', { ascending: false })
        .limit(200);
      songs = data;
    } catch (error) {
      console.warn(`Could not load the ${region} regional chart:`, error);
    }
  }

  return <RegionalClientContent initialSongs={songs || []} region={region} />;
}