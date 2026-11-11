import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import NearbyEventsRail from '@/components/NearbyEventsRail';
import StructuredData from '@/components/StructuredData';
import { getTicketRegionSummaries, loadConcertRegionRows } from '@/lib/ticket-regions';
import { createBreadcrumbListSchema } from '@/lib/seo-schema';
import { isLiveTourDate } from '@/lib/tour-profile';

export const revalidate = 300;

const BASE_URL = 'https://musictop.net';
const numberFormatter = new Intl.NumberFormat('en-US');

export const metadata: Metadata = {
  title: 'Concert Tickets by Region (2026) | MusicTop',
  description: 'Official concert tickets and tour dates for every region MusicTop tracks. Browse live artist listings, next on-sale dates and verified ticket links, region by region.',
  alternates: { canonical: `${BASE_URL}/tickets` },
  openGraph: {
    title: 'Concert Tickets by Region | MusicTop',
    description: 'Live artist listings, next on-sale dates and verified ticket links, region by region.',
    url: `${BASE_URL}/tickets`,
    siteName: 'MusicTop',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Concert Tickets by Region | MusicTop',
    description: 'Live artist listings, next on-sale dates and verified ticket links, region by region.',
  },
};

function formatNextShow(value: string | null): string {
  if (!value) return 'Dates to be confirmed';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Dates to be confirmed';

  return `Next show · ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default async function TicketRegionsPage() {
  const [regions, rows] = await Promise.all([getTicketRegionSummaries(), loadConcertRegionRows()]);
  const artistTotal = regions.reduce((total, region) => total + region.artistCount, 0);
  const liveDateTotal = rows.filter((row) => isLiveTourDate(row.date)).length;

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Tickets', href: '/tickets' },
  ];

  const stats = [
    { label: 'Regions', value: numberFormatter.format(regions.length) },
    { label: 'Artists on sale', value: numberFormatter.format(artistTotal) },
    { label: 'Live dates', value: numberFormatter.format(liveDateTotal) },
  ];

  return (
    <div className="mt-page mt-page--paper">
      <StructuredData
        data={createBreadcrumbListSchema([
          { name: 'Home', url: '/' },
          { name: 'Tickets', url: '/tickets' },
        ])}
      />
      {regions.length > 0 && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Concert tickets by region',
            itemListElement: regions.map((region, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: `Concert tickets in ${region.label}`,
              url: `${BASE_URL}/tickets/${encodeURIComponent(region.region)}`,
            })),
          }}
        />
      )}

      <main className="mt-container py-12 sm:py-16 lg:py-20">
        <Breadcrumbs items={breadcrumbs} tone="light" />

        <NearbyEventsRail className="mt-8 border-b border-line pb-10" />

        {/* Two lines and out of the way. The title says what this is, the sentence
            says where the links go, and the figures sit beside them on one row —
            the grid of regions is the content, and it starts higher for it. */}
        <div className="mt-12 flex flex-col gap-5 border-b-2 border-ink pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-black leading-[0.98] tracking-[-0.05em] text-ink uppercase lg:whitespace-nowrap">
              Concert tickets by region
            </h1>
            <p className="mt-2 max-w-3xl text-[0.9375rem] leading-snug text-muted">
              Every region we track, ordered by the artists on sale; links go straight to the promoter or Ticketmaster.
            </p>
          </div>

          <dl className="flex shrink-0 gap-x-6 gap-y-2">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[9px] font-bold tracking-[0.18em] text-muted uppercase">{stat.label}</dt>
                <dd className="mt-1 font-mono text-lg font-black leading-none tracking-[-0.04em] text-ink tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* `role="list"` is required, not redundant: Preflight's `list-style: none`
            makes Safari drop list semantics, and VoiceOver then skips the count. */}
        {regions.length > 0 ? (
          <ul role="list" className="mt-6 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {regions.map((region) => (
              <li key={region.region}>
                <Link
                  href={`/tickets/${encodeURIComponent(region.region)}`}
                  className="group flex h-full flex-col justify-between bg-white p-5 transition-colors hover:bg-paper-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-red"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-2xl font-black leading-none tracking-[-0.04em] text-ink uppercase">{region.label}</span>
                    <span className="shrink-0 text-[10px] font-bold tracking-[0.14em] text-accent-red uppercase tabular-nums">
                      {numberFormatter.format(region.artistCount)} artists
                    </span>
                  </span>

                  <span className="mt-10 block">
                    <span className="block text-[10px] font-bold tracking-[0.14em] text-muted uppercase">{formatNextShow(region.nextDate)}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black tracking-[0.16em] text-ink uppercase transition-colors group-hover:text-accent-blue">
                      Open tickets
                      <ArrowUpRight aria-hidden="true" className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 border border-line bg-paper-muted px-5 py-10 text-center">
            <p className="text-[11px] font-bold tracking-[0.16em] text-muted uppercase">No ticket regions are available right now.</p>
            <Link href="/news/us" className="mt-4 inline-flex items-center gap-1 text-[10px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red">
              Read the latest music news
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        )}

        <section aria-labelledby="ticket-regions-note" className="mt-14 border-t-2 border-ink pt-5">
          <h2 id="ticket-regions-note" className="text-[10px] font-black tracking-[0.24em] text-ink uppercase">How listings are verified</h2>
          <p className="mt-4 max-w-2xl text-[0.9625rem] leading-relaxed text-muted sm:text-sm">
            We read each artist from the promoter feed, group duplicate spellings onto one artist page, and only keep dates that
            have not passed. Prices and availability sit with the ticketing partner, so the link is always the source of truth.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/news/us" className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red">
              Music news
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
            <Link href="/festivals/us" className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red">
              Festival guides
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
