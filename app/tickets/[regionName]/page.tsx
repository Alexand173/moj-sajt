import type { Metadata } from 'next';
import ConcertsList from '@/components/ConcertsList';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { getNewsletterSignupUrl } from '@/lib/newsletter';
import { getArtistIdentityDirectory, mergeTicketRows, type TicketSourceRow } from '@/lib/tour-profile';

export const revalidate = 300;

type Params = Promise<{ regionName: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type TicketRow = {
  id: string;
  artist_name: string;
  image_url: string;
  video_url?: string | null;
  date: string;
  location: string;
  city?: string | null;
  ticket_link?: string | null;
};

const TICKET_COLUMNS = 'id, artist_name, image_url, video_url, date, location, city, ticket_link';

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { regionName } = await params;
  if (!regionName) return { title: 'Music Tickets | MusicTop' };
  const region = regionName.toUpperCase();
  const displayRegion = region === 'UK' ? 'the UK' : region;

  return {
    title: `Live Music Tickets in ${displayRegion} (${new Date().getFullYear()}) | MusicTop`,
    description: `Find upcoming concert dates, verified ticket links, and live event availability for top artists performing in ${displayRegion}. Check live ticket updates now!`,
    alternates: { canonical: `https://musictop.net/tickets/${regionName.toLowerCase()}` },
  };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { regionName } = await params;
  const query = await searchParams;
  if (!regionName) return <div className="py-20 text-center text-muted">Region not found.</div>;

  const initialSearchQuery = firstSearchParam(query.artist) || '';
  const initialCity = firstSearchParam(query.city) || null;
  const initialPage = parsePage(firstSearchParam(query.page));

  const supabase = getPublicSupabaseClient();
  let data: TicketRow[] = [];

  if (supabase) {
    try {
      const { data: concerts } = await supabase.from('koncerti').select(TICKET_COLUMNS).ilike('region', regionName);
      data = (concerts || []) as TicketRow[];
    } catch (error) {
      console.warn(`Could not load ${regionName} tickets:`, error);
    }
  }

  const identityDirectory = await getArtistIdentityDirectory();
  const grouped = mergeTicketRows(data as TicketSourceRow[], identityDirectory);

  return (
    <div className="mt-page mt-page--paper">
      <main>
        <ConcertsList
          dataZaPrikaz={grouped}
          initialSearchQuery={initialSearchQuery}
          initialCity={initialCity}
          initialPage={initialPage}
          regionName={regionName}
          newsletterSignupUrl={getNewsletterSignupUrl()}
        />
      </main>
    </div>
  );
}
