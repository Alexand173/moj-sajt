import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin } from 'lucide-react';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}): Promise<Metadata> {
  const { regionName, id } = await params;
  const region = regionName.toLowerCase();
  const canonical = `/festivals/${encodeURIComponent(region)}/${encodeURIComponent(id)}`;

  return {
    title: `Festival Details in ${region.toUpperCase()}`,
    description: `Explore festival details, lineup information, and official tickets for this ${region.toUpperCase()} music festival.`,
    alternates: { canonical },
    openGraph: {
      title: `Festival Details in ${region.toUpperCase()}`,
      description: `Explore festival details, lineup information, and official tickets for this ${region.toUpperCase()} music festival.`,
      url: canonical,
      type: 'website',
    },
  };
}

type FestivalRecord = {
  name: string;
  location: string;
  description: string | null;
  lineup: string[] | null;
  image_url: string[] | null;
  video_id: string | null;
  tickets_url: string;
};

export default async function FestivalDetailPage({
  params,
}: {
  params: Promise<{ regionName: string; id: string }>;
}) {
  const { id, regionName } = await params;
  const supabase = getPublicSupabaseClient();
  if (!supabase) notFound();

  let fest: FestivalRecord | null = null;
  try {
    const { data } = await supabase.from('festivals').select('*').eq('id', id).single();
    fest = data as FestivalRecord | null;
  } catch (error) {
    console.warn(`Could not load festival ${id}:`, error);
  }

  if (!fest) notFound();

  return (
    <div className="mt-page mt-page--paper pt-10 pb-20 font-sans">
      <div className="mt-container">
        <Link href={`/festivals/${regionName}`} className="mb-12 inline-flex items-center gap-2 border-b border-ink pb-2 text-[10px] font-black tracking-[0.25em] text-ink uppercase transition-colors hover:border-accent-red hover:text-accent-red">
          ← Back to {regionName.toUpperCase()} calendar
        </Link>

        <header className="relative mb-14 border-b border-line pb-10">
          <p className="mt-kicker">Festival profile</p>
          <h1 className="mt-5 max-w-5xl text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.82] tracking-[-0.08em] text-ink uppercase">{fest.name}</h1>
          <div className="mt-6 inline-flex max-w-full items-center gap-2 bg-ink px-4 py-2 text-xs font-black tracking-[0.12em] text-white uppercase"><MapPin aria-hidden="true" className="size-3 text-accent-blue" /><span className="truncate">{fest.location} · 2026</span></div>
        </header>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <main className="lg:col-span-8">
            {fest.video_id && (
              <div className="mb-14 aspect-video overflow-hidden border border-ink bg-ink shadow-[12px_12px_0_var(--mt-accent-red)]">
                <iframe
                  src={`https://www.youtube.com/embed/${fest.video_id}?rel=0&modestbranding=1`}
                  title={`${fest.name} festival video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="h-full w-full grayscale transition-all duration-700 hover:grayscale-0"
                />
              </div>
            )}

            <section className="mb-16">
              <div className="mb-5 flex items-center gap-2 text-[10px] font-black tracking-[0.24em] text-accent-red uppercase"><CalendarDays aria-hidden="true" className="size-3" /> About the festival</div>
              <p className="border-l-4 border-accent-red pl-6 text-2xl font-black leading-[0.95] tracking-[-0.04em] text-muted sm:text-4xl">&quot;{fest.description || 'Festival details will be updated soon.'}&quot;</p>
            </section>

            <section className="mb-20">
              <h2 className="mb-8 flex items-center gap-3 text-xs font-black tracking-[0.3em] text-ink uppercase"><span className="h-px w-8 bg-accent-red" />Official 2026 lineup</h2>
              {fest.lineup && fest.lineup.length > 0 ? (
                <div className="flex flex-wrap gap-x-8 gap-y-4 border-b border-line pb-12">
                  {fest.lineup.map((artist, index) => <span key={`${artist}-${index}`} className="text-3xl font-black leading-none tracking-[-0.06em] text-ink transition-colors hover:text-accent-red sm:text-5xl">{artist}</span>)}
                </div>
              ) : <p className="border border-line bg-paper-muted p-8 text-sm font-bold text-muted">Lineup information will be announced soon.</p>}
            </section>

            {Array.isArray(fest.image_url) && fest.image_url.length > 0 && (
              <section>
                <h2 className="mb-8 text-xs font-black tracking-[0.3em] text-ink uppercase">Festival gallery</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {fest.image_url.map((image, index) => <div key={`${image}-${index}`} className="group aspect-[16/10] overflow-hidden bg-ink"><img src={image} alt={`${fest.name} festival image ${index + 1}`} className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" /></div>)}
                </div>
              </section>
            )}
          </main>

          <aside className="border-t border-line pt-6 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8">
            <p className="mt-meta text-muted">Official festival source</p>
            <h2 className="mt-3 text-2xl font-black leading-none tracking-[-0.04em] text-ink uppercase">Plan the experience</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">Check the official festival page for the latest schedule, lineup updates, and ticket information.</p>
            <a href={fest.tickets_url} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 bg-ink px-5 py-3 text-[10px] font-black tracking-[0.18em] text-white uppercase transition-colors hover:bg-accent-red">Visit official site <span aria-hidden="true">↗</span></a>
          </aside>
        </div>
      </div>
    </div>
  );
}
