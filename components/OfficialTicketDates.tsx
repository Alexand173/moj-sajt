import Image from 'next/image';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { generisiAffiliateLink } from '@/lib/ticket-affiliate';
import PaginationRail from '@/components/PaginationRail';
import type { GroupedConcert } from '@/components/ticket-types';

interface OfficialTicketDatesProps {
  data: GroupedConcert[];
  hasActiveFilters: boolean;
  emptyStateMessage: string;
  onClearFilters: () => void;
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}

function FilterResultCount({ count }: { count: number }) {
  return (
    <p role="status" aria-live="polite" className="text-[9px] font-black tracking-[0.12em] text-accent-red uppercase">
      {count} matching {count === 1 ? 'artist' : 'artists'}
    </p>
  );
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: 'TBC', weekday: '' };
  return {
    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(date),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
  };
}

export default function OfficialTicketDates({
  data,
  hasActiveFilters,
  emptyStateMessage,
  onClearFilters,
  currentPage,
  totalPages,
  totalResults,
  onPageChange,
}: OfficialTicketDatesProps) {
  return (
    <section id="official-ticket-dates" aria-labelledby="official-ticket-dates-heading" className="mt-container scroll-mt-32 py-14 sm:py-16 lg:py-20">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-3.5 text-accent-red" />
          <h2 id="official-ticket-dates-heading" className="text-[10px] font-black tracking-[0.24em] text-ink uppercase">Official ticket dates</h2>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && <FilterResultCount count={data.length} />}
          <span className="hidden text-[9px] font-bold tracking-[0.16em] text-muted uppercase sm:inline">Tickets via Ticketmaster</span>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="mt-ticket-card-rail gap-4 pb-2">
          {data.map((group) => (
            <article key={group.artist_name} className="mt-ticket-card group flex min-w-0 flex-col overflow-hidden border border-line bg-white transition-colors hover:border-ink">
              <div className="relative h-48 overflow-hidden bg-ink sm:h-52">
                {group.image_url && (
                  <Image
                    src={group.image_url}
                    alt={group.artist_name}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 84vw"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    className="object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                  />
                )}
                <div className="mt-image-overlay absolute inset-0" />
                <div className="absolute inset-x-4 bottom-4">
                  <p className="mt-meta text-white/60">Official tour</p>
                  <h3 className="mt-1.5 line-clamp-2 text-2xl font-black leading-[0.95] tracking-[-0.05em] text-white">{group.artist_name}</h3>
                </div>
                <span className="absolute right-4 top-4 bg-accent-red px-2.5 py-1 text-[9px] font-black tracking-[0.12em] text-white uppercase">{group.events.length} dates</span>
              </div>
              <ul className="max-h-64 overflow-y-auto overscroll-contain divide-y divide-line">
                {group.events.map((event) => {
                  const formattedDate = formatEventDate(event.date);
                  return (
                    <li key={event.id} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-paper-hover">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black tracking-tight text-ink tabular-nums">{formattedDate.date}</span>
                          <span className="text-[9px] font-bold tracking-widest text-muted uppercase">{formattedDate.weekday}</span>
                        </div>
                        <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] leading-tight text-muted">
                          <MapPin aria-hidden="true" className="size-3 shrink-0 text-accent-blue" />
                          <span className="truncate">{event.location}</span>
                        </p>
                      </div>
                      {event.ticket_link?.trim() ? (
                        <a href={generisiAffiliateLink(event.ticket_link.trim())} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[9px] font-black tracking-[0.12em] text-white uppercase transition-colors hover:bg-accent-red">
                          <Ticket aria-hidden="true" className="size-3" />Tickets
                        </a>
                      ) : (
                        <button type="button" disabled aria-label={`Tickets unavailable for ${group.artist_name}`} className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full bg-ink/45 px-3 py-2 text-[9px] font-black tracking-[0.12em] text-white/75 uppercase">
                          <Ticket aria-hidden="true" className="size-3" />Tickets
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-line bg-paper-muted px-6 py-20 text-center">
          <p className="text-sm font-bold tracking-[0.14em] text-muted uppercase">{emptyStateMessage}</p>
          {hasActiveFilters && <button type="button" onClick={onClearFilters} className="mt-4 text-xs font-black tracking-[0.12em] text-accent-red uppercase underline underline-offset-4">Clear filters</button>}
        </div>
      )}

      {data.length > 0 && totalPages > 1 && (
        <PaginationRail
          currentPage={currentPage}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={onPageChange}
        />
      )}
    </section>
  );
}
