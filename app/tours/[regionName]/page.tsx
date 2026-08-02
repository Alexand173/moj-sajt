import ConcertsList from '@/components/ConcertsList';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { Metadata } from 'next';

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

// --- KORAK 1: DINAMIČKI METADATA ZA GOOGLE ---
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { regionName } = await params;
  
  if (!regionName) return { title: 'Music Concerts & Tours | MusicTop' };
  
  const region = regionName.toUpperCase();
  
  // Prilagođavamo gramatiku za lepši prikaz na Google-u
  const displayRegion = region === 'UK' ? 'the UK' : region;

  return {
    title: `Live Music Concerts & Tours in ${displayRegion} (${new Date().getFullYear()}) | MusicTop`,
    description: `Find upcoming concert dates, arena tour schedules, and ticket availability for top artists performing in ${displayRegion}. Check live ticket updates now!`,
    alternates: {
      canonical: `https://musictop.net/tours/${regionName.toLowerCase()}`,
    }
  };
}

export default async function Page({ params }: { params: Params }) {
  const { regionName } = await params;

  if (!regionName) {
    return <div className="text-center py-20 text-gray-500">Region not found.</div>;
  }

  const supabase = getPublicSupabaseClient();
  let data: TourRow[] = [];

  if (supabase) {
    try {
      const { data: concerts } = await supabase
        .from('koncerti')
        .select('*')
        .ilike('region', regionName);
      data = (concerts || []) as TourRow[];
    } catch (error) {
      console.warn(`Could not load ${regionName} tours:`, error);
    }
  }

  // --- LOGIKA GRUPISANJA ---
  const grupisani = data.reduce<Record<string, GroupedTour>>((acc, item) => {
    const key = item.artist_name;
    if (!acc[key]) {
      acc[key] = {
        artist_name: item.artist_name,
        image_url: item.image_url,
        events: []
      };
    }
    acc[key].events.push({
      id: item.id,
      date: item.date,
      location: item.location,
      city: item.city,
      ticket_link: item.ticket_link,
    });
    return acc;
  }, {});

  const dataZaPrikaz = Object.values(grupisani);

  const region = regionName.toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* --- KORAK 2: MOĆNIJI I OPTIMIZOVANIJI H1 NASLOV --- */}
      <h1 className="text-4xl font-bold mb-2 text-center text-white uppercase tracking-wide">
        Live Music Concerts & Tours in {region === 'UK' ? 'the UK' : region}
      </h1>
      <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto text-sm">
        Explore current tour schedules, verified ticket links, and live event availability across the region.
      </p>

      <ConcertsList dataZaPrikaz={dataZaPrikaz} />

    </div>
  );
}