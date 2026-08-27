import type { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import FestivalCard, { type FestivalCardData } from '@/components/FestivalCard';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ regionName: string }> }): Promise<Metadata> {
  const { regionName } = await params;
  const region = regionName.toLowerCase();
  const canonical = `/festivals/${encodeURIComponent(region)}`;
  return {
    title: `Best Music Festivals in ${region.toUpperCase()} - 2026 Guide`,
    description: `Discover upcoming music festivals in ${region} for 2026. Get tickets and info.`,
    alternates: { canonical },
    openGraph: { title: `Best Music Festivals in ${region.toUpperCase()} - 2026 Guide`, description: `Discover upcoming music festivals in ${region} for 2026. Get tickets and info.`, url: canonical, type: 'website' },
  };
}

export default async function RegionalFestivalsPage({ params }: { params: Promise<{ regionName: string }> }) {
  const { regionName } = await params;
  const region = regionName.toLowerCase();
  const today = new Date().toISOString();
  const supabase = getPublicSupabaseClient();
  let festivals: FestivalCardData[] | null = null;
  let hasDatabaseError = false;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('festivals').select('*').eq('region', region).gte('date_start', today).order('date_start', { ascending: true });
      festivals = (data || []) as FestivalCardData[];
      hasDatabaseError = Boolean(error);
    } catch (error) {
      console.warn(`Could not load ${region} festivals:`, error);
      hasDatabaseError = true;
    }
  }

  if (hasDatabaseError) return <div className="mt-page mt-page--paper px-6 py-32 text-center text-xs font-black tracking-[0.16em] text-accent-red uppercase">Festival guide is temporarily unavailable</div>;

  return (
    <div className="mt-page mt-page--paper">
      <section className="border-b border-line">
        <div className="mt-container py-14 lg:py-20">
          <p className="mt-kicker">2026 global guide</p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <h1 className="mt-display text-[clamp(3.75rem,11vw,9rem)] text-ink">{region}<span className="text-accent-red">.</span>Fest</h1>
            <div className="text-left sm:text-right"><span className="block text-[9px] font-bold tracking-[0.2em] text-muted uppercase">{festivals?.length || 0} events found</span><span className="mt-2 block text-[9px] font-black tracking-[0.2em] text-accent-red uppercase">Updated weekly · links verified</span></div>
          </div>
        </div>
      </section>

      <main className="mt-container py-10 lg:py-14">
        <div className="mb-6 flex items-center gap-2"><span className="text-accent-red">▣</span><h2 className="text-xs font-black tracking-[0.24em] text-ink uppercase">The 2026 lineup</h2></div>
        {festivals && festivals.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {festivals.map((festival, index) => (
              <FestivalCard key={festival.id} festival={festival} featured={index === 0} screenshotUrl={`https://api.microlink.io/?url=${encodeURIComponent(festival.tickets_url)}&screenshot=true&embed=screenshot.url`} />
            ))}
          </div>
        ) : (
          <div className="border border-line bg-paper-muted px-6 py-28 text-center"><h3 className="text-4xl font-black tracking-[-0.06em] text-muted uppercase sm:text-6xl">No upcoming festivals</h3></div>
        )}
      </main>
    </div>
  );
}
