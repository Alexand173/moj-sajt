import type { Metadata } from 'next';
import ConcertsList from '@/components/ConcertsList';
import StructuredData from '@/components/StructuredData';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { getNewsletterSignupUrl } from '@/lib/newsletter';
import { createBreadcrumbListSchema } from '@/lib/seo-schema';
import { getTicketRegionLabel } from '@/lib/ticket-regions';
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
  const displayRegion = getTicketRegionLabel(regionName);

  return {
    title: `Live Music Tickets in ${displayRegion} (${new Date().getFullYear()}) | MusicTop`,
    description: `Concert tickets and tour dates for artists playing ${displayRegion}. Browse verified Ticketmaster links, presale codes and on-sale countdowns for every live date.`,
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

  // Matches the visible trail rendered above the announcements heading.
  const regionPagePath = `/tickets/${encodeURIComponent(regionName.toLowerCase())}`;
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Tickets', href: '/tickets' },
    { label: getTicketRegionLabel(regionName) },
  ];
  const breadcrumbSchema = createBreadcrumbListSchema([
    { name: 'Home', url: '/' },
    { name: 'Tickets', url: '/tickets' },
    { name: getTicketRegionLabel(regionName), url: regionPagePath },
  ]);

  return (
    <div className="mt-page mt-page--paper">
      <StructuredData data={breadcrumbSchema} />
      <main>
        <ConcertsList
          dataZaPrikaz={grouped}
          initialSearchQuery={initialSearchQuery}
          initialCity={initialCity}
          initialPage={initialPage}
          regionName={regionName}
          newsletterSignupUrl={getNewsletterSignupUrl()}
          breadcrumbs={breadcrumbs}
        />
      </main>
    </div>
  );
}
