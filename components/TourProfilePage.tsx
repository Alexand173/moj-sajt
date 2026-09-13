/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  Building2,
  Disc3,
  MapPin,
  Music,
  Play,
  ShoppingBag,
  Star,
  Ticket,
} from 'lucide-react';
import Image from 'next/image';
import StructuredData from '@/components/StructuredData';
import VenuePreviewCard from '@/components/VenuePreviewCard';
import { generisiAffiliateLink } from '@/lib/ticket-affiliate';
import { getYouTubeEmbedUrl } from '@/lib/news-media';
import type { TourPageData } from '@/lib/tour-profile';
import type { TourVenue } from '@/lib/tour-profile-core';
import { createBreadcrumbListSchema, createMusicEventSchema, createVideoObjectSchema, toAbsoluteSiteUrl } from '@/lib/seo-schema';

function SectionLabel({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'blue' }) {
  return (
    <div className={`mb-5 flex items-center gap-2 text-[10px] font-black tracking-[0.24em] uppercase ${tone === 'blue' ? 'text-accent-blue' : 'text-accent-red'}`}>
      <span className="h-px w-7 bg-current" />
      {children}
    </div>
  );
}

function SafeExternalLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
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

function uniqueCities(events: TourPageData['group']['events']): string[] {
  return Array.from(new Set(events.map((event) => event.city || event.location.split(',')[0]).filter(Boolean)));
}

function createVenues(profileVenues: TourVenue[], events: TourPageData['group']['events']): TourVenue[] {
  const eventVenues = events.map((event) => ({
    name: event.location.split(',')[0].trim(),
    city: event.city || event.location.split(',').slice(-1)[0]?.trim() || 'Tour stop',
    info: 'Check the official venue and event instructions before travelling. Date-specific details are kept in the ticket panel.',
  }));
  const combined = [...profileVenues, ...eventVenues];
  const seen = new Set<string>();
  return combined.filter((venue) => {
    const key = `${venue.name}|${venue.city}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function TourTicketPanel({ data }: { data: TourPageData }) {
  const events = data.group.events;

  return (
    <section aria-labelledby="tour-ticket-dates" className="border border-line bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Ticket aria-hidden="true" className="size-4 text-accent-red" />
        <h2 id="tour-ticket-dates" className="text-[10px] font-black tracking-[0.25em] text-ink uppercase">Official ticket dates</h2>
      </div>
      <ul className="divide-y divide-line">
        {events.map((event) => {
          const formattedDate = formatEventDate(event.date);
          return (
            <li key={event.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tabular-nums text-ink">{formattedDate.date}</span>
                  <span className="text-[9px] font-bold tracking-widest text-muted uppercase">{formattedDate.weekday}</span>
                </div>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-tight text-muted">
                  <MapPin aria-hidden="true" className="size-3 shrink-0 text-accent-blue" />
                  <span className="truncate">{event.location}</span>
                </p>
              </div>
              {event.ticket_link ? (
                <SafeExternalLink
                  href={generisiAffiliateLink(event.ticket_link)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[9px] font-black tracking-[0.12em] text-white uppercase transition-colors hover:bg-accent-red focus-visible:outline-accent-red"
                >
                  <Ticket aria-hidden="true" className="size-3" /> Tickets <ArrowUpRight aria-hidden="true" className="size-3" />
                </SafeExternalLink>
              ) : (
                <span className="shrink-0 text-[9px] font-black tracking-[0.12em] text-muted uppercase">Link pending</span>
              )}
            </li>
          );
        })}
      </ul>
      {events[0]?.ticket_link && (
        <SafeExternalLink
          href={generisiAffiliateLink(events[0].ticket_link)}
          className="mt-5 flex min-h-12 w-full items-center justify-center bg-accent-red px-4 py-3 text-center text-[10px] font-black tracking-[0.18em] text-white uppercase transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-red"
        >
          Buy official tickets <ArrowUpRight aria-hidden="true" className="ml-2 size-3.5" />
        </SafeExternalLink>
      )}
      <p className="mt-3 text-center text-[9px] font-bold tracking-[0.12em] text-ticket-green uppercase">✓ Verified · official Ticketmaster source</p>
    </section>
  );
}

function AdPlaceholder({ artist }: { artist: string }) {
  return (
    <section aria-label="Advertising space" className="border border-dashed border-line bg-paper-muted p-5 text-center">
      <p className="text-[9px] font-black tracking-[0.3em] text-placeholder uppercase">Advertising space</p>
      <div className="mt-3 flex h-36 items-center justify-center border border-line bg-white text-[10px] font-bold tracking-[0.12em] text-placeholder uppercase">Your brand here</div>
      <p className="mt-3 text-[8px] font-bold tracking-[0.14em] text-muted uppercase">Reach fans of {artist}</p>
    </section>
  );
}

function PopularSongs({ songs }: { songs: TourPageData['profile']['popularSongs'] }) {
  if (songs.length === 0) return null;
  return (
    <section aria-labelledby="popular-songs" className="border border-line bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Music aria-hidden="true" className="size-4 text-accent-red" />
        <h2 id="popular-songs" className="text-[10px] font-black tracking-[0.25em] text-ink uppercase">Most popular songs</h2>
      </div>
      <ol className="divide-y divide-line">
        {songs.map((song, index) => (
          <li key={song.title} className="flex items-start gap-3 py-3">
            <span className="w-7 shrink-0 text-lg font-black leading-none text-line-strong tabular-nums">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black tracking-tight text-ink">{song.title}</p>
              <p className="mt-1 text-[10px] leading-snug text-muted">{song.note}</p>
            </div>
            {song.year && <span className="text-[9px] font-bold tracking-widest text-placeholder tabular-nums">{song.year}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function WhyGoPanel() {
  return (
    <section className="bg-ink p-5 text-white sm:p-6">
      <h2 className="text-[10px] font-black tracking-[0.25em] text-accent-red uppercase">Why you should go</h2>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/75">
        <li className="flex gap-2"><span className="text-accent-red">→</span> A career-spanning setlist you cannot get from streaming.</li>
        <li className="flex gap-2"><span className="text-accent-red">→</span> Production built specifically for these venues.</li>
        <li className="flex gap-2"><span className="text-accent-red">→</span> Official tickets with no resale markup on the source link.</li>
        <li className="flex gap-2"><span className="text-accent-red">→</span> A night that becomes a story you tell for years.</li>
      </ul>
    </section>
  );
}

function VideoFrame({ videoId, title, fallbackUrl }: { videoId?: string; title: string; fallbackUrl?: string }) {
  if (!videoId) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center border border-line bg-ink px-6 text-center text-white">
        <Play aria-hidden="true" className="size-8 text-accent-red" />
        <p className="mt-4 text-sm font-black">Video preview on YouTube</p>
        {fallbackUrl && <SafeExternalLink href={fallbackUrl} className="mt-4 bg-white px-4 py-2 text-[9px] font-black tracking-[0.15em] text-ink uppercase hover:bg-accent-red hover:text-white">Open YouTube ↗</SafeExternalLink>}
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden border border-line bg-ink">
      <iframe
        src={getYouTubeEmbedUrl(videoId)}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}

export default function TourProfilePage({ data }: { data: TourPageData }) {
  const { profile, group, regionName, pageUrl } = data;
  const cities = uniqueCities(group.events);
  const venues = createVenues(profile.venues, group.events);
  const eventSummary = group.events.map((event) => `${formatEventDate(event.date).date} ${event.city || event.location}`).join(' · ');
  const breadcrumbSchema = createBreadcrumbListSchema([
    { name: 'Home', url: '/' },
    { name: `${regionName.toUpperCase()} Tickets`, url: `/tickets/${encodeURIComponent(regionName)}` },
    { name: profile.canonicalName, url: pageUrl },
  ]);
  const groupSchema = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: profile.canonicalName,
    description: profile.bio,
    image: [profile.heroImageUrl, ...profile.galleryImageUrls],
    url: toAbsoluteSiteUrl(pageUrl),
    member: profile.members.map((member) => ({ '@type': 'Person', name: member.name, jobTitle: member.role })),
  };
  const eventSchemas = group.events.map((event) => createMusicEventSchema({
    name: `${profile.canonicalName} — ${profile.tourTitle}`,
    description: profile.seoDescription,
    startDate: event.date,
    location: event.location,
    url: pageUrl,
    image: [profile.heroImageUrl],
    ticketsUrl: event.ticket_link ? generisiAffiliateLink(event.ticket_link) : undefined,
  }));
  const freshVideoSchema = profile.freshMusicVideoId
    ? createVideoObjectSchema({
        name: `${profile.canonicalName} fresh music`,
        description: `Watch a fresh ${profile.canonicalName} music video before the tour.`,
        videoId: profile.freshMusicVideoId,
        pageUrl,
      })
    : null;

  return (
    <div className="mt-page mt-page--paper mt-tour-profile pb-20">
      <StructuredData data={breadcrumbSchema} />
      <StructuredData data={groupSchema} />
      {eventSchemas.map((schema, index) => <StructuredData key={`${group.events[index].id}-schema`} data={schema} />)}
      {freshVideoSchema && <StructuredData data={freshVideoSchema} />}

      <header className="mt-tour-profile__hero relative min-h-[32rem] overflow-hidden bg-ink text-white sm:min-h-[38rem] lg:min-h-[44rem]">
        <Image src={profile.heroImageUrl} alt={`${profile.canonicalName} live performance`} fill priority sizes="100vw" className="object-cover grayscale" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(8_9_10),rgb(8_9_10_/_0.62)_48%,rgb(8_9_10_/_0.18))]" />
        <div className="relative mx-auto flex min-h-[32rem] w-full max-w-[1600px] items-end px-6 pb-10 sm:min-h-[38rem] sm:px-10 sm:pb-14 lg:min-h-[44rem] lg:px-16">
          <div className="max-w-5xl">
            <Link href={`/tickets/${regionName}`} className="inline-flex border-b border-white/50 pb-2 text-[10px] font-black tracking-[0.25em] text-white/70 uppercase transition-colors hover:border-white hover:text-white">← All tours</Link>
            <p className="mt-6 text-[10px] font-black tracking-[0.28em] text-accent-red uppercase">Official tour · {group.events.length} dates</p>
            <h1 className="mt-3 text-[clamp(3.5rem,9vw,8.5rem)] font-black leading-[0.82] tracking-[-0.085em] text-white">{profile.canonicalName}: {profile.tourTitle}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-lg">{profile.tagline}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-12 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-12 lg:gap-16 lg:px-16 lg:py-20">
        <main className="min-w-0 lg:col-span-8">
          <section aria-labelledby="the-artist" className="border-b border-line pb-12">
            <SectionLabel><Star aria-hidden="true" className="size-3" /> The artist</SectionLabel>
            <h2 id="the-artist" className="text-3xl font-black tracking-[-0.06em] text-ink sm:text-5xl">{profile.canonicalName}</h2>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">{profile.bio}</p>
          </section>

          <section aria-labelledby="the-band" className="mt-14">
            <SectionLabel tone="blue"><Music aria-hidden="true" className="size-3" /> The band</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.members.map((member) => (
                <article key={member.name} className="group overflow-hidden border border-line bg-white transition-colors hover:border-ink">
                  <div className="relative h-56 overflow-hidden bg-ink">
                    <img src={member.imageUrl} alt={member.imageAlt} loading="lazy" decoding="async" className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(8_9_10_/_0.9),transparent_65%)]" />
                    <h3 className="absolute inset-x-4 bottom-3 text-sm font-black leading-tight text-white">{member.name}</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] font-black tracking-[0.18em] text-accent-red uppercase">{member.role}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{member.bio}</p>
                    <a href={member.imageSourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-[8px] font-bold tracking-[0.12em] text-muted uppercase underline underline-offset-2 hover:text-ink">Photo source · {member.imageSourceName} ↗</a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="more-about-the-artist" className="mt-14 border-t border-line pt-12">
            <SectionLabel tone="blue"><Star aria-hidden="true" className="size-3" /> More about the artist</SectionLabel>
            <div className="space-y-5 text-base leading-relaxed text-muted sm:text-lg">
              {profile.moreAbout.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>

          <section aria-labelledby="fresh-music" className="mt-14">
            <SectionLabel><Play aria-hidden="true" className="size-3" /> Fresh music</SectionLabel>
            <VideoFrame videoId={profile.freshMusicVideoId} title={`${profile.canonicalName} fresh music video`} />
            <p className="mt-3 text-xs text-muted">Listen before you go — press play, turn it up, then choose your date.</p>
          </section>

          <section aria-labelledby="best-albums" className="mt-14">
            <SectionLabel tone="blue"><Disc3 aria-hidden="true" className="size-3" /> Best albums</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {profile.albums.map((album) => (
                <article key={album.title} className="border border-line bg-white p-5 transition-colors hover:border-ink">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-black tracking-tight text-ink">{album.title}</h3>
                    <span className="text-[9px] font-bold tracking-widest text-placeholder tabular-nums">{album.year}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{album.highlight}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="in-their-own-words" className="mt-14">
            <SectionLabel tone="blue"><Play aria-hidden="true" className="size-3" /> In their own words</SectionLabel>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
              <div>
                <VideoFrame videoId={profile.interviewVideoId} title={`${profile.canonicalName} interview`} fallbackUrl={profile.interviewSearchUrl} />
              </div>
              <div className="space-y-5 text-base leading-relaxed text-muted">
                {profile.interviewText.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          </section>

          <section aria-labelledby="awards-honors" className="mt-14">
            <SectionLabel><Award aria-hidden="true" className="size-3" /> Awards &amp; honors</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {profile.awards.map((award) => (
                <article key={award.title} className="flex items-start gap-3 border border-line bg-white p-5">
                  <span className="flex size-8 shrink-0 items-center justify-center bg-accent-red/10 text-accent-red"><Award aria-hidden="true" className="size-4" /></span>
                  <div>
                    <h3 className="text-sm font-black text-ink">{award.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{award.note}</p>
                    {award.year && <span className="mt-2 inline-block text-[9px] font-bold tracking-widest text-placeholder tabular-nums">{award.year}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="on-the-road" className="mt-14 border-t border-line pt-12">
            <SectionLabel><Ticket aria-hidden="true" className="size-3" /> On the road</SectionLabel>
            <h2 id="on-the-road" className="text-3xl font-black tracking-[-0.06em] text-ink sm:text-5xl">{group.events.length} {group.events.length === 1 ? 'night' : 'nights'} · {cities.length} {cities.length === 1 ? 'city' : 'cities'}</h2>
            <div className="mt-5 space-y-5 text-base leading-relaxed text-muted sm:text-lg">
              <p>The {profile.tourTitle} run moves through {cities.join(', ') || 'the listed cities'} — a route chosen to match the scale of this production. Each stop is a live event with a current date and official ticket source in the panel beside this story.</p>
              {eventSummary && <p>{eventSummary}. Dates and ticket availability can change, so use the official link for the latest seat map and purchase terms.</p>}
              <p>Getting there is part of the night. Plan transit, parking, accessibility, and arrival time before the lights go down. Whatever ticket tier you choose, the official source is the safest place to start.</p>
            </div>
          </section>

          <section aria-labelledby="where-its-happening" className="mt-14">
            <SectionLabel tone="blue"><Building2 aria-hidden="true" className="size-3" /> Where it&apos;s happening</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {venues.map((venue, index) => <VenuePreviewCard key={`${venue.name}-${venue.city}`} venue={venue} index={index} />)}
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted">Venue details are a planning aid. Always confirm the event-day instructions on the official venue and Ticketmaster pages before travelling.</p>
          </section>

          {profile.merch.length > 0 && (
            <section aria-labelledby="official-merch" className="mt-14 bg-ink p-6 text-white sm:p-8">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <SectionLabel><ShoppingBag aria-hidden="true" className="size-3" /> Official merch</SectionLabel>
                  <h2 id="official-merch" className="text-3xl font-black tracking-[-0.06em] sm:text-5xl">{profile.canonicalName.toUpperCase()} STORE</h2>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">Take a piece of the tour home — apparel, music, and collectibles for the production.</p>
                </div>
                <span className="text-[9px] font-bold tracking-[0.15em] text-white/40 uppercase">Ships globally · demo store</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {profile.merch.map((item) => (
                  <article key={item.name} className="border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-accent-red">
                    <div className="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_65%_35%,rgb(199_45_69_/_0.5),rgb(8_9_10)_65%)] text-center">
                      <span className="px-2 text-[9px] font-black tracking-[0.14em] text-white/60 uppercase">{item.type}</span>
                    </div>
                    <h3 className="mt-3 text-xs font-black text-white">{item.name}</h3>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-black tabular-nums">{item.priceLabel}</span>
                      <button type="button" disabled className="bg-accent-red px-2 py-1.5 text-[8px] font-black tracking-[0.1em] text-white uppercase disabled:cursor-not-allowed">Add to cart</button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="mt-5 text-[9px] font-bold tracking-[0.14em] text-white/35 uppercase">Demo store · checkout coming soon</p>
            </section>
          )}
        </main>

        <aside className="min-w-0 lg:col-span-4">
          <div className="space-y-6 lg:sticky lg:top-28">
            <TourTicketPanel data={data} />
            <AdPlaceholder artist={profile.canonicalName.toUpperCase()} />
            <PopularSongs songs={profile.popularSongs} />
            <WhyGoPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
