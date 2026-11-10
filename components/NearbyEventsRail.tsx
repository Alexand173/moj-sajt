'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Star, Ticket } from 'lucide-react';
import type { NearbyEvent } from '@/lib/nearby-events';
import useSavedEvents from '@/hooks/useSavedEvents';

type NearbyResponse = {
  location: { city: string | null; regionKey: string; regionLabel: string } | null;
  events: NearbyEvent[];
};

/** Honoured by the arrows only; scrolling a list is motion too. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const weekdayMonthDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The feed stores `YYYY-MM-DD` and carries no start time, so the card states the
 * day and never a clock time. Reading the day in UTC stops the date slipping to
 * the previous evening for visitors west of Greenwich.
 */
function formatShowDate(value: string): { label: string; iso: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return { label: 'Date to be confirmed', iso: value };

  const eventDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = Math.round((eventDay - today) / 86_400_000);

  if (difference === 0) return { label: 'Today', iso: value };
  if (difference === 1) return { label: 'Tomorrow', iso: value };

  return { label: weekdayMonthDayFormatter.format(eventDay), iso: value };
}

const kilometreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Distance is the reason the rail is ordered the way it is, so it is stated on the
 * card. A show in the visitor's own city reads "in town" rather than a "0 km".
 */
function formatDistance(distanceKm: number | null): { label: string; ariaLabel: string } | null {
  if (distanceKm === null) return null;
  if (distanceKm <= 0) return { label: 'in town', ariaLabel: 'in your town' };

  const value = kilometreFormatter.format(distanceKm);
  return { label: `${value} km`, ariaLabel: `${value} kilometres away` };
}

/** First and last initial, at most two: `Koncert przy świecach` → KŚ, `Aitana` → AI. */
function artistInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'MT';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();

  const first = Array.from(words[0])[0];
  const last = Array.from(words[words.length - 1])[0];
  return `${first}${last}`.toUpperCase();
}

/** Ticketmaster artwork can stall as well as 404; neither should leave a blank card. */
const IMAGE_FALLBACK_MS = 6000;

/**
 * Poster or initials. Ticketmaster artwork 404s and stalls more often than the
 * feed implies, and an empty dark rectangle reads as a broken card, so a failed
 * or stalled load falls back to the artist's initials over the brand pattern.
 */
function ArtistThumb({ src, artist }: { src: string | null; artist: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  // The watchdog must not run for cards the browser has not reached yet:
  // `loading="lazy"` defers the request, and a timer started at mount would
  // replace a perfectly good poster with initials before it was ever fetched.
  const [nearViewport, setNearViewport] = useState(() => typeof IntersectionObserver === 'undefined');
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!src || !image || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });

    observer.observe(image);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    if (!src || !nearViewport) return undefined;

    const timer = window.setTimeout(() => {
      // A photo that already painted is never replaced by the timeout.
      setStatus((current) => (current === 'loaded' ? current : 'failed'));
    }, IMAGE_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [src, nearViewport]);

  if (!src || status === 'failed') {
    return (
      <div className="relative h-full w-full overflow-hidden bg-ink" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgb(230_57_70_/_0.32),transparent_62%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgb(255_255_255_/_0.07)_0,rgb(255_255_255_/_0.07)_1px,transparent_1px,transparent_9px)]" />
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-black tracking-[-0.08em] text-white/70">
          {artistInitials(artist)}
        </span>
        <span className="absolute bottom-2 right-3 text-[8px] font-bold tracking-[0.26em] text-white/25 uppercase">MusicTop</span>
      </div>
    );
  }

  return (
    <img
      ref={imageRef}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('failed')}
      className="h-full w-full object-cover transition-all duration-700 motion-reduce:transition-none"
    />
  );
}

/**
 * Shows within reach of the visitor's IP-derived city, with the whole region as a
 * safety net. The rail is fetched on the client so the tickets hub keeps its
 * shared cache and no visitor's location ends up in the HTML we serve everyone.
 */
export default function NearbyEventsRail({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [location, setLocation] = useState<NearbyResponse['location']>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const railRef = useRef<HTMLUListElement | null>(null);
  const { ids: saved, failedEvent, toggle: toggleSaved } = useSavedEvents();

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/events/nearby', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { location: null, events: [] }))
      .then((payload: NearbyResponse) => {
        const nextEvents = payload.events || [];
        setLocation(payload.location || null);
        setEvents(nextEvents);
        setStatus(nextEvents.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => setStatus('empty'));

    return () => controller.abort();
  }, []);

  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    setEdges({
      start: rail.scrollLeft <= 4,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    if (status !== 'ready') return undefined;

    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [status, events.length, syncEdges]);

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;

    const card = rail.querySelector('[data-nearby-card]') as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: direction * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const isNearYou = Boolean(location?.city);
  // One heading in every case: the city is already named in the kicker and subline.
  const heading = 'Concerts nearby';
  const subline = isNearYou
    ? `Shows within reach of ${location?.city} — plus the rest of the ${location?.regionLabel ?? 'world'} schedule.`
    : 'The soonest dates on sale right now, across every region we track.';
  // The rail sits above the page title, so it keeps its slot even when the feed
  // returns nothing: an empty section here would drag the title of the page up.
  const emptyCopy = isNearYou
    ? `No dates are on sale within reach of ${location?.city} right now. Every date we track is listed by region below.`
    : 'The promoter feed has no dates on sale right now. Every date we track is listed by region below.';
  // Announced once the rail resolves, so neither a count nor an empty result is silent.
  const countAnnouncement = status === 'ready'
    ? (isNearYou
      ? `${events.length} concerts near ${location?.city}.`
      : `${events.length} concerts on sale across every region we track.`)
    : status === 'empty'
      ? (isNearYou ? `No concerts on sale near ${location?.city} right now.` : 'No concerts on sale right now.')
      : '';

  return (
    <section aria-labelledby="nearby-events" className={className}>
      <p role="status" aria-live="polite" className="sr-only">{countAnnouncement}</p>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mt-kicker text-accent-red">
            <MapPin aria-hidden="true" className="size-3" />
            {isNearYou ? `Near ${location?.city}` : 'Next dates'}
          </p>
          <h2 id="nearby-events" className="mt-3 text-3xl font-black leading-[0.95] tracking-[-0.06em] text-ink sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{subline}</p>
          {failedEvent && (
            <p role="status" className="mt-2 max-w-xl text-[11px] font-bold tracking-[0.04em] text-accent-red">
              {failedEvent.label
                ? `Couldn't save ${failedEvent.label}. Check your connection and try again.`
                : "Couldn't sync your saved events. Check your connection and try again."}
            </p>
          )}
        </div>

        {/* `min-h-9` holds the row on phones where it stacks under the heading,
            so dropping the arrows in the empty state cannot shorten the section. */}
        <div className="flex min-h-9 items-center gap-2 sm:shrink-0">
          {location && location.regionKey !== 'world' && (
            <Link
              href={`/tickets/${location.regionKey}`}
              className="mr-1 inline-flex items-center gap-1 text-[10px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red"
            >
              All {location.regionLabel} dates
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </Link>
          )}
          {status === 'ready' && (
            <>
              <button
                type="button"
                onClick={() => scrollRail(-1)}
                disabled={edges.start}
                aria-label="Previous nearby events"
                className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-placeholder"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollRail(1)}
                disabled={edges.end}
                aria-label="More nearby events"
                className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-placeholder"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'empty' && (
        // Sized to the rail it replaces (312px on phones, 328px from sm, plus the
        // same mt-7/pb-2), so an empty feed leaves the page exactly where it was.
        <div className="mt-7 pb-2">
          <div className="flex h-[19.5rem] flex-col justify-center gap-4 border border-dashed border-line-strong bg-paper-muted/40 px-6 sm:h-[20.5rem]">
            <CalendarDays aria-hidden="true" className="size-5 text-placeholder" />
            <span className="text-[10px] font-black tracking-[0.2em] text-ink uppercase">
              {isNearYou ? 'Nothing on sale nearby' : 'Nothing on sale right now'}
            </span>
            <p className="max-w-md text-sm leading-relaxed text-muted">{emptyCopy}</p>
          </div>
        </div>
      )}

      {status !== 'empty' && (
        <ul
          // Preflight removes list markers, and Safari drops list semantics when it
          // does; the explicit role keeps the rail announced as a list in VoiceOver.
          role="list"
          ref={railRef}
          onScroll={syncEdges}
          className="mt-7 -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 no-scrollbar"
        >
        {status === 'loading' &&
          [0, 1, 2].map((placeholder) => (
            <li
              key={`skeleton-${placeholder}`}
              aria-hidden="true"
              // Sized to a loaded card (312px on phones, 328px from sm) so the rail,
              // now above the fold, cannot push the page title down when it resolves.
              className="flex h-[19.5rem] min-w-[80vw] flex-col border border-line bg-white sm:h-[20.5rem] sm:min-w-[22rem] lg:min-w-[24rem]"
            >
              <div className="h-44 animate-pulse bg-paper-muted motion-reduce:animate-none sm:h-48" />
              <div className="flex flex-1 animate-pulse flex-col gap-3 p-4 motion-reduce:animate-none">
                <div className="h-4 w-3/4 bg-paper-muted" />
                <div className="h-3 w-1/2 bg-paper-muted" />
                <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                  <div className="h-3 w-16 bg-paper-muted" />
                  <div className="h-3 w-14 bg-paper-muted" />
                </div>
              </div>
            </li>
          ))}

        {status === 'ready' &&
          events.map((event) => {
            const show = formatShowDate(event.date);
            const isSaved = saved.has(event.id);
            const distance = formatDistance(event.distanceKm);

            return (
              <li
                key={event.id}
                data-nearby-card
                data-distance-km={event.distanceKm ?? undefined}
                className="min-w-[80vw] snap-start border border-line bg-white transition-colors hover:border-ink sm:min-w-[22rem] lg:min-w-[24rem]"
              >
                <article className="group flex h-full flex-col">
                  <div className="relative h-44 overflow-hidden bg-ink sm:h-48">
                    <ArtistThumb src={event.imageUrl} artist={event.artist} />
                    {event.city && (
                      <span className="absolute left-0 top-0 bg-ink/85 px-2 py-1 text-[8px] font-black tracking-[0.14em] text-white uppercase">
                        {event.city}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-black leading-tight tracking-[-0.02em] text-ink">{event.artist}</h3>
                      <button
                        type="button"
                        onClick={() => toggleSaved({ id: event.id, label: event.artist })}
                        aria-pressed={isSaved}
                        aria-label={isSaved ? `Remove ${event.artist} from saved events` : `Save ${event.artist} to saved events`}
                        className={`shrink-0 rounded-full p-1 transition-colors ${isSaved ? 'text-accent-red' : 'text-placeholder hover:text-ink'}`}
                      >
                        <Star aria-hidden="true" className={`size-4 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Venue and distance share the existing line, so a card keeps
                        its height and the rail cannot shift the page below it. */}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-[11px] text-muted">
                        {event.venue || event.city || 'Venue to be announced'}
                      </p>
                      {distance && (
                        <span
                          aria-label={distance.ariaLabel}
                          className="shrink-0 text-[10px] font-bold tracking-[0.04em] text-placeholder uppercase tabular-nums"
                        >
                          {distance.label}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold tracking-[0.08em] text-muted uppercase">
                        <CalendarDays aria-hidden="true" className="size-3 shrink-0 text-accent-blue" />
                        <time dateTime={show.iso} className="truncate">{show.label}</time>
                      </span>
                      {event.ticketUrl ? (
                        <a
                          href={event.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black tracking-[0.12em] text-ink uppercase transition-colors hover:text-accent-red"
                        >
                          <Ticket aria-hidden="true" className="size-3" />
                          Tickets
                          <ArrowUpRight aria-hidden="true" className="size-3" />
                        </a>
                      ) : (
                        <span className="shrink-0 text-[9px] font-black tracking-[0.12em] text-placeholder uppercase">Link pending</span>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
