'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bell, Clock3 } from 'lucide-react';
import type { GroupedConcert } from '@/components/ticket-types';

type AnnouncementStatus = 'just-announced' | 'on-sale-now' | 'last-chance' | 'new-dates';

type Announcement = {
  status: AnnouncementStatus;
  artist: string;
  subtitle: string;
  venue: string;
  saleCopy: string;
};

const fallbackAnnouncements: Announcement[] = [
  { status: 'just-announced', artist: 'Bruno Mars', subtitle: 'The Romantic Tour 2026', venue: 'Wembley Stadium · Jul 28', saleCopy: 'Presale opens Wed 10:00 GMT' },
  { status: 'on-sale-now', artist: 'Nick Cave & The Bad Seeds', subtitle: 'European Summer Run', venue: 'Preston Park · Jul 31', saleCopy: 'General on-sale · selling fast' },
  { status: 'last-chance', artist: 'Jack White', subtitle: 'No Name Tour', venue: 'Eventim Apollo · Aug 26', saleCopy: 'Final release · under 200 seats' },
  { status: 'new-dates', artist: 'OMD', subtitle: 'Architecture & More Anniversary', venue: 'Kälvinge Bandstand · Jul 30', saleCopy: 'Two nights added by demand' },
];

const statusCopy: Record<AnnouncementStatus, string> = {
  'just-announced': 'Just announced',
  'on-sale-now': 'On sale now',
  'last-chance': 'Last chance',
  'new-dates': 'New dates',
};

const statusClasses: Record<AnnouncementStatus, string> = {
  'just-announced': 'bg-accent-red',
  'on-sale-now': 'bg-accent-blue',
  'last-chance': 'bg-ink text-white',
  'new-dates': 'bg-ticket-green',
};

function getAnnouncements(groups: GroupedConcert[]): Announcement[] {
  return fallbackAnnouncements.map((fallback, index) => {
    const group = groups[index];
    const event = group?.events[0];
    return {
      ...fallback,
      artist: group?.artist_name || fallback.artist,
      venue: event?.location || fallback.venue,
      saleCopy: event?.date ? `Next date · ${new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : fallback.saleCopy,
    };
  });
}

function getNextEventTimestamp(groups: GroupedConcert[]): number | null {
  const now = Date.now();
  const timestamps = groups.flatMap((group) => group.events.map((event) => new Date(event.date).getTime()))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > now)
    .sort((a, b) => a - b);
  return timestamps[0] || null;
}

function formatCountdown(milliseconds: number | null): string {
  if (milliseconds === null) return 'TBC';
  const remaining = Math.max(0, milliseconds);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export default function TicketAnnouncements({ groups }: { groups: GroupedConcert[] }) {
  const announcements = useMemo(() => getAnnouncements(groups), [groups]);
  const nextEvent = useMemo(() => getNextEventTimestamp(groups), [groups]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextEvent) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextEvent]);

  const remaining = nextEvent ? nextEvent - now : null;

  return (
    <section aria-labelledby="ticket-announcements" className="bg-ink text-white">
      <div className="mt-container py-14 sm:py-16 lg:py-20">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mt-kicker text-accent-red"><Bell aria-hidden="true" className="size-3" /> Concert announcements</p>
            <h2 id="ticket-announcements" className="mt-4 text-balance text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-5xl lg:text-6xl">On-sale alerts &amp; new tour dates</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/55">Verified announcements straight from the promoters. The moment a tour drops, you&apos;ll see it here — with presale codes, on-sale countdowns and direct Ticketmaster links.</p>
          </div>
          <div className="w-fit border border-white/20 bg-white/[0.03] px-5 py-4 lg:min-w-40">
            <p className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] text-white/45 uppercase"><Clock3 aria-hidden="true" className="size-3 text-accent-red" /> Next general on-sale</p>
            <p aria-live="polite" className="mt-2 whitespace-nowrap font-mono text-lg font-black tracking-[-0.05em] text-white">{formatCountdown(remaining)}</p>
          </div>
        </div>

        <div className="mt-8 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 no-scrollbar md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
          {announcements.map((announcement) => (
            <div key={announcement.status} className="min-w-[78vw] snap-start border border-white/15 bg-white/[0.035] p-4 transition-colors hover:border-white/40 sm:min-w-[20rem] md:min-w-0">
              <span className={`inline-flex px-2 py-1 text-[8px] font-black tracking-[0.16em] text-white uppercase ${statusClasses[announcement.status]}`}>
                {statusCopy[announcement.status]}
              </span>
              <p className="mt-5 text-xl font-black leading-tight tracking-[-0.04em]">{announcement.artist}</p>
              <p className="mt-1 text-[10px] font-bold text-white/65">{announcement.subtitle}</p>
              <p className="mt-4 truncate text-[9px] tracking-[0.08em] text-white/45">{announcement.venue}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-[9px] font-bold tracking-[0.08em] text-white/55">
                <span className="truncate">{announcement.saleCopy}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-white">Buy <ArrowUpRight aria-hidden="true" className="size-3" /></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
