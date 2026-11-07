'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Star, Ticket } from 'lucide-react';
import type { NearbyEvent } from '@/lib/nearby-events';

type NearbyResponse = {
  location: { city: string | null; regionKey: string; regionLabel: string } | null;
  events: NearbyEvent[];
};

const SAVED_EVENTS_KEY = 'musictop:saved-events';

type SavedResponse = {
  authenticated: boolean;
  ids: string[];
  persisted: boolean;
};

function readSavedEvents(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SAVED_EVENTS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/** Guest fallback: the star still works without an account, on this device only. */
function persistLocalSavedEvents(ids: Set<string>): void {
  try {
    window.localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private mode or a full quota: the star still works for this session.
  }
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

/** At most two initials: `Koncert przy świecach` → KP, `Aitana` → AI. */
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

  useEffect(() => {
    if (!src) return undefined;

    const timer = window.setTimeout(() => {
      // A photo that already painted is never replaced by the timeout.
      setStatus((current) => (current === 'loaded' ? current : 'failed'));
    }, IMAGE_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [src]);

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
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('failed')}
      className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
    />
  );
}

/**
 * Shows within reach of the visitor's IP-derived city, with the whole region as a
 * safety net. The rail is fetched on the client so the tickets hub keeps its
 * shared cache and no visitor's location ends up in the HTML we serve everyone.
 */
export default function NearbyEventsRail({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'hidden'>('loading');
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [location, setLocation] = useState<NearbyResponse['location']>(null);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [savedSource, setSavedSource] = useState<'account' | 'device'>('device');
  const [edges, setEdges] = useState({ start: true, end: false });
  const railRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/events/nearby', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { location: null, events: [] }))
      .then((payload: NearbyResponse) => {
        const nextEvents = payload.events || [];
        setLocation(payload.location || null);
        setEvents(nextEvents);
        setStatus(nextEvents.length > 0 ? 'ready' : 'hidden');
      })
      .catch(() => setStatus('hidden'));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Saved ids come from the account when there is one. Guests, and accounts on a
    // database that has not run the saved_events migration, fall back to this device.
    fetch('/api/saved-events', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SavedResponse | null) => {
        if (controller.signal.aborted) return;

        if (payload?.authenticated && payload.persisted) {
          setSaved(new Set(payload.ids));
          setSavedSource('account');
          return;
        }

        setSaved(readSavedEvents());
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSaved(readSavedEvents());
      });

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
    rail.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const toggleSaved = (event: NearbyEvent) => {
    const next = new Set(saved);
    if (next.has(event.id)) next.delete(event.id);
    else next.add(event.id);

    setSaved(next);

    if (savedSource === 'device') {
      persistLocalSavedEvents(next);
      return;
    }

    void fetch('/api/saved-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(next) }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Saved events request failed with ${response.status}.`);
      })
      .catch((error: unknown) => {
        // The star stays optimistic; the next toggle re-sends the whole list.
        console.warn('Could not persist saved events:', error);
      });
  };

  if (status === 'hidden') return null;

  const isNearYou = Boolean(location?.city);
  // One heading in both cases: the city is already named in the kicker and subline.
  const heading = 'Concerts nearby';
  const subline = isNearYou
    ? `Shows within reach of ${location?.city} — plus the rest of the ${location?.regionLabel ?? 'world'} schedule.`
    : 'The soonest dates on sale right now, across every region we track.';

  return (
    <section aria-labelledby="nearby-events" className={`mt-14 border-t border-line pt-10 ${className}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mt-kicker text-accent-red">
            <MapPin aria-hidden="true" className="size-3" />
            {isNearYou ? `${location?.city} · near you` : 'On sale now'}
          </p>
          <h2 id="nearby-events" className="mt-3 text-3xl font-black leading-[0.95] tracking-[-0.06em] text-ink sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{subline}</p>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          {location && location.regionKey !== 'world' && (
            <Link
              href={`/tickets/${location.regionKey}`}
              className="mr-1 inline-flex items-center gap-1 text-[10px] font-black tracking-[0.16em] text-ink uppercase transition-colors hover:text-accent-red"
            >
              All {location.regionLabel} dates
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </Link>
          )}
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
        </div>
      </div>

      <ul
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
              className="min-w-[80vw] animate-pulse border border-line bg-white sm:min-w-[22rem] lg:min-w-[24rem]"
            >
              <div className="h-44 bg-paper-muted sm:h-48" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-3/4 bg-paper-muted" />
                <div className="h-2.5 w-1/2 bg-paper-muted" />
                <div className="h-2.5 w-2/3 bg-paper-muted" />
              </div>
            </li>
          ))}

        {status === 'ready' &&
          events.map((event) => {
            const show = formatShowDate(event.date);
            const isSaved = saved.has(event.id);

            return (
              <li
                key={event.id}
                data-nearby-card
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
                        onClick={() => toggleSaved(event)}
                        aria-pressed={isSaved}
                        aria-label={isSaved ? `Remove ${event.artist} from saved events` : `Save ${event.artist} to saved events`}
                        className={`shrink-0 rounded-full p-1 transition-colors ${isSaved ? 'text-accent-red' : 'text-placeholder hover:text-ink'}`}
                      >
                        <Star aria-hidden="true" className={`size-4 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <p className="truncate text-[11px] text-muted">
                      {event.venue || event.city || 'Venue to be announced'}
                    </p>

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
    </section>
  );
}
