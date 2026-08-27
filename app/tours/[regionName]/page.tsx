import type { Metadata } from 'next';
import ConcertsList from '@/components/ConcertsList';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export const revalidate = 300;

type Params = Promise<{ regionName: string }>;

type TourRow = {
  id: string;
  artist_name: string;
  image_url: string;
  date: string;
  location: string;
  city?: string | null;
  ticket_link: string;
};

type GroupedTour = {
  artist_name: string;
  image_url: string;
  events: Array<Pick<TourRow, 'id' | 'date' | 'location' | 'city' | 'ticket_link'>>;
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { regionName } = await params;
  if (!regionName) return { title: 'Music Concerts & Tours | MusicTop' };
  const region = regionName.toUpperCase();
  const displayRegion = region === 'UK' ? 'the UK' : region;

  return {
    title: `Live Music Concerts & Tours in ${displayRegion} (${new Date().getFullYear()}) | MusicTop`,
    description: `Find upcoming concert dates, arena tour schedules, and ticket availability for top artists performing in ${displayRegion}. Check live ticket updates now!`,
    alternates: { canonical: `https://musictop.net/tours/${regionName.toLowerCase()}` },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { regionName } = await params;
  if (!regionName) return <div className="py-20 text-center text-muted">Region not found.</div>;

  const supabase = getPublicSupabaseClient();
  let data: TourRow[] = [];

  if (supabase) {
    try {
      const { data: concerts } = await supabase.from('koncerti').select('*').ilike('region', regionName);
      data = (concerts || []) as TourRow[];
    } catch (error) {
      console.warn(`Could not load ${regionName} tours:`, error);
    }
  }

  const grouped = data.reduce<Record<string, GroupedTour>>((accumulator, item) => {
    const key = item.artist_name;
    if (!accumulator[key]) accumulator[key] = { artist_name: item.artist_name, image_url: item.image_url, events: [] };
    accumulator[key].events.push({ id: item.id, date: item.date, location: item.location, city: item.city, ticket_link: item.ticket_link });
    return accumulator;
  }, {});

  const region = regionName.toUpperCase();

  return (
    <div className="mt-page mt-page--paper">
      <section className="border-b border-line">
        <div className="mt-container py-14 lg:py-20">
          <p className="mt-kicker">On the road · 2026</p>
          <h1 className="mt-display mt-5 text-[clamp(4.5rem,12vw,10rem)] text-ink">Tours</h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted sm:text-base">Explore current tour schedules, verified ticket links, and live event availability across {region === 'UK' ? 'the UK' : region}.</p>
        </div>
      </section>
      <main className="mt-container py-10 lg:py-14">
        <ConcertsList dataZaPrikaz={Object.values(grouped)} />
      </main>
    </div>
  );
}
