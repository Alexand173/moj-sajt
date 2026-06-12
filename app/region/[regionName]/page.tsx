import { createClient } from '@supabase/supabase-js';
import RegionalClientContent from '@/components/RegionalClientContent';

export default async function RegionalPage({ params }: { params: Promise<{ regionName: string }> }) {
  const { regionName } = await params;
  const region = regionName.toUpperCase();

  // Supabase klijent sa procesnim varijablama
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('region', region)
    .order('votes', { ascending: false })
    .limit(100);

  return <RegionalClientContent initialSongs={songs || []} region={region} />;
}