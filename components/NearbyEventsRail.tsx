'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, MapPin, Star, Ticket } from 'lucide-react';
import type { NearbyEvent } from '@/lib/nearby-events';
import useSavedEvents from '@/hooks/useSavedEvents';

type NearbyResponse = {
  location: { city: string | null; regionKey: string; regionLabel: string } | null;
  events: NearbyEvent[];
};

/** Honoured by the scroll buttons only; scrolling a list is motion too. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const showDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The feed stores `YYYY-MM-DD` with no start time, so a row states the day and
 * never a clock time. Reading the day in UTC stops the date slipping to the
 * previous evening for visitors west of Greenwich.
 */
function formatShowDate(value: string): { label: string; iso: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return { label: 'Date TBC', iso: value };

  const eventDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = Math.round((eventDay - today) / 86_400_000);

  if (difference === 0) return { label: 'Today', iso: value };
  if (difference === 1) return { label: 'Tomorrow', iso: value };

  return { label: showDateFormatter.format(eventDay), iso: value };
}

const kilometreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Distance is the ordering rule of this section, so it is stated on every row.
 * A show in the visitor's own city reads "in town" rather than 0 km.
 */
function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null) return null;
  if (distanceKm <= 0) return 'in town';

  return `${kilometreFormatter.format(distanceKm)} km`;
}

/** First and last initial, at most two: `Koncert przy świecach` → KŚ, `Aitana` → AI. */
function artistInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'MT';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();

  return `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`.toUpperCase();
}

/** Ticketmaster artwork stalls as often as it 404s; neither should leave a blank row. */
const IMAGE_FALLBACK_MS = 6000;

/**
 * Poster or initials. A row is 48 px square, so a failed poster has to fall back
 * to something that still identifies the artist rather than a grey hole.
 */
function ArtistThumb({ src, artist }: { src: string | null; artist: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  // A timer started at mount would replace a lazy image that the browser has not
  // requested yet, so the watchdog only starts once the row is near the viewport.
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
      setStatus((current) => (current === 'loaded' ? current : 'failed'));
    }, IMAGE_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [src, nearViewport]);

  if (!src || status === 'failed') {
    return (
      <div className="flex size-full items-center justify-center bg-ink" aria-hidden="true">
        <span className="text-xs font-black tracking-[-0.04em] text-white/70">{artistInitials(artist)}</span>
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
      className="size-full object-cover"
    />
  );
}

type NearbyRowProps = {
  event: NearbyEvent;
  saved: boolean;
  onToggle: () => void;
};

/**
 * One show. A grid row, not a card: the pitch is fixed at 84 px on phones and
 * 72 px from `sm`, so five rows fit the window on a phone and six on a desktop
 * and the distance column lines up down the whole board.
 */
function NearbyRow({ event, saved, onToggle }: NearbyRowProps) {
  const date = formatShowDate(event.date);
  const distance = formatDistance(event.distanceKm);

  return (
    <li
      data-nearby-row
      className="grid h-[84px] grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line transition-colors hover:bg-paper-muted/50 sm:h-[72px] sm:grid-cols-[3rem_minmax(0,1fr)_4.5rem_7rem_auto] sm:gap-x-4"
    >
      <div className="size-12 shrink-0 overflow-hidden bg-paper-muted">
        <ArtistThumb src={event.imageUrl} artist={event.artist} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-black leading-tight tracking-[-0.01em] text-ink">{event.artist}</p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">
          {event.venue ?? event.city ?? 'Venue to be announced'}
        </p>
        {/* Phones hide the date and distance columns, so the row repeats both
            here rather than losing them. */}
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted tabular-nums sm:hidden">
          <span>{date.label}</span>
          {distance && <span className="text-line-strong">/</span>}
          {distance && <span>{distance}</span>}
        </p>
      </div>

      <span className="hidden text-right font-mono text-[11px] tabular-nums text-muted sm:block">
        {distance ?? '—'}
      </span>

      <time
        dateTime={date.iso}
        className="hidden text-right font-mono text-[11px] uppercase tracking-[0.04em] text-ink tabular-nums sm:block"
      >
        {date.label}
      </time>

      <div className="flex items-center gap-1 justify-self-end sm:gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${event.artist} from saved events` : `Save ${event.artist}`}
          className={`grid size-6 place-items-center border transition-colors sm:size-7 ${saved ? 'border-accent-red text-accent-red' : 'border-line text-muted hover:border-ink hover:text-ink'}`}
        >
          <Star aria-hidden="true" className={`size-3 sm:size-3.5 ${saved ? 'fill-current' : ''}`} />
        </button>

        {event.ticketUrl ? (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Tickets for ${event.artist}`}
            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-ink transition-colors hover:text-accent-red"
          >
            <Ticket aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">Tickets</span>
            {/* The arrow is the first thing to go on a phone: the artist name
                needs the width more than the link needs decoration. */}
            <ArrowUpRight aria-hidden="true" className="hidden size-3 sm:inline" />
          </a>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-placeholder">Soon</span>
        )}
      </div>
    </li>
  );
}

/**
 * Concerts the visitor can get to, as a departure board rather than a rail.
 *
 * The form follows the job. A horizontal rail of wide cards shows four shows per
 * screen and buries the rest behind arrows nobody presses; distance — the one
 * thing this section knows that the region grid below does not — gets a column of
 * its own and reads down the page as a scale. Six rows fit above the region grid,
 * and the board holds its exact height while loading and when empty, because it
 * sits above the page title.
 *
 * The visitor is placed on the server from their address (`lib/geo-location`):
 * the shipped GeoLite2 database first, corrected to the nearest real city when
 * an address resolves to a village.
 */
export default function NearbyEventsRail({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [location, setLocation] = useState<NearbyResponse['location']>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const boardRef = useRef<HTMLUListElement | null>(null);
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
    const board = boardRef.current;
    if (!board) return;

    setEdges({
      start: board.scrollTop <= 4,
      end: board.scrollTop + board.clientHeight >= board.scrollHeight - 4,
    });
  }, []);

  useEffect(() => {
    if (status !== 'ready') return undefined;

    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [status, events.length, syncEdges]);

  const scrollBoard = (direction: -1 | 1) => {
    const board = boardRef.current;
    if (!board) return;

    const row = board.querySelector('[data-nearby-row]') as HTMLElement | null;
    const step = (row?.offsetHeight ?? 76) * 2;
    board.scrollBy({ top: direction * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const city = location?.city ?? null;
  const inTown = events.filter((event) => event.distanceKm !== null && event.distanceKm <= 0).length;

  const subline = city
    ? (inTown > 0 ? `${inTown} in ${city}, the rest within reach.` : 'The nearest dates we track, closest first.')
    : 'The soonest dates on sale right now, across every region we track.';

  const emptyCopy = city
    ? `Nothing is on sale within reach of ${city} right now. Every date we track is listed by region below.`
    : 'The promoter feed has no dates on sale right now. Every date we track is listed by region below.';

  // Announced once the board resolves, so neither a count nor an empty result is silent.
  const countAnnouncement = status === 'ready'
    ? (city ? `${events.length} concerts near ${city}.` : `${events.length} concerts on sale across every region we track.`)
    : status === 'empty'
      ? (city ? `No concerts on sale near ${city} right now.` : 'No concerts on sale right now.')
      : '';

  return (
    <section aria-labelledby="nearby-events" className={className}>
      <p role="status" aria-live="polite" className="sr-only">{countAnnouncement}</p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="nearby-events" className="text-3xl font-black leading-[0.95] tracking-[-0.06em] text-ink sm:text-4xl">
            Concerts nearby
          </h2>
          {city && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] font-black tracking-[0.16em] text-accent-red uppercase">
              <MapPin aria-hidden="true" className="size-3" />
              Near {city}
            </p>
          )}
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{subline}</p>
          {failedEvent && (
            <p role="status" className="mt-2 max-w-xl text-[11px] font-bold tracking-[0.04em] text-accent-red">
              {failedEvent.label
                ? `Couldn't save ${failedEvent.label}. Check your connection and try again.`
                : "Couldn't sync your saved events. Check your connection and try again."}
            </p>
          )}
        </div>

        {/* `min-h-8` holds the row on phones where it stacks under the heading, so
            dropping the arrows in the empty state cannot shorten the section. */}
        <div className="flex min-h-8 items-center gap-2 sm:shrink-0">
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
                onClick={() => scrollBoard(-1)}
                disabled={edges.start}
                aria-label="Earlier nearby concerts"
                className="inline-flex size-8 items-center justify-center border border-line text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-placeholder"
              >
                <ChevronUp aria-hidden="true" className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollBoard(1)}
                disabled={edges.end}
                aria-label="Later nearby concerts"
                className="inline-flex size-8 items-center justify-center border border-line text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-placeholder"
              >
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Column strip. A header over a fixed-height window is what makes the list
          read as a board; the km and date columns are only labelled where they
          are actually visible. */}
      {status === 'ready' && (
        <div
          aria-hidden="true"
          className="mt-6 hidden items-center gap-x-4 border-b border-ink pb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-muted sm:flex"
        >
          <span className="w-12 shrink-0" />
          <span className="min-w-0 flex-1">Artist / venue</span>
          <span className="w-[4.5rem] shrink-0 text-right">Distance</span>
          <span className="w-28 shrink-0 text-right">Date</span>
          <span className="w-16 shrink-0" />
        </div>
      )}

      {status === 'empty' && (
        /* The board's own height, so an empty result leaves the page title where
           it was instead of pulling the whole page up. */
        <div className="mt-6">
          <div className="flex h-[26.25rem] flex-col justify-center gap-4 border-y border-line-strong bg-paper-muted/40 px-6 sm:h-[28.75rem]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-ink">
              {city ? 'No dates within reach' : 'No dates on sale'}
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted">{emptyCopy}</p>
            <Link
              href={location?.regionKey ? `/tickets/${location.regionKey}` : '/tickets'}
              className="inline-flex w-fit items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-ink transition-colors hover:text-accent-red"
            >
              Browse {location?.regionLabel ?? 'all regions'}
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="mt-6 h-[26.25rem] overflow-hidden sm:h-[28.75rem]" aria-hidden="true">
          <ul className="border-t border-line">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <li key={index} className="flex h-[84px] items-center gap-3 border-b border-line sm:h-[72px] sm:gap-4">
                <div className="size-12 shrink-0 bg-paper-muted" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="h-3 w-40 bg-paper-muted" />
                  <div className="h-2.5 w-28 bg-paper-muted/70" />
                </div>
                <div className="hidden h-2.5 w-16 shrink-0 bg-paper-muted sm:block" />
                <div className="hidden h-2.5 w-20 shrink-0 bg-paper-muted sm:block" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'ready' && (
        <ul
          // Preflight removes list markers and Safari drops list semantics with
          // them; the explicit role keeps the board announced as a list.
          role="list"
          ref={boardRef}
          onScroll={syncEdges}
          className="mt-0 h-[27rem] overflow-y-auto overscroll-contain border-t border-line sm:h-[29rem]"
        >
          {events.map((event) => (
            <NearbyRow
              key={event.id}
              event={event}
              saved={saved.has(event.id)}
              onToggle={() => toggleSaved({ id: event.id, label: event.artist })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
