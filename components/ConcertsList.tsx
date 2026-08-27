'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { CalendarDays, MapPin, Search, Ticket } from 'lucide-react';
import { resolveConcertCity } from '@/lib/concert-city';

interface Event {
  id: string;
  date: string;
  location: string;
  city?: string | null;
  ticket_link: string;
}

interface GroupedConcert {
  artist_name: string;
  image_url: string;
  events: Event[];
}

interface ConcertsListProps {
  dataZaPrikaz: GroupedConcert[];
}

function generisiAffiliateLink(izvorniLink: string): string {
  if (!izvorniLink) return '#';
  if (izvorniLink.includes('evyy.net')) return izvorniLink;

  const mojImpactId = '7366014';
  const proveraLinka = izvorniLink.toLowerCase();
  const affiliateMape: Record<string, { mediaRail: string; campaign: string }> = {
    'moshtix.com.au': { mediaRail: '1958987', campaign: '23905' },
    'ticketmaster.com': { mediaRail: '264167', campaign: '4272' },
    'ticketmaster.be': { mediaRail: '1958966', campaign: '23894' },
    'moshtix.co.nz': { mediaRail: '1958990', campaign: '23906' },
    'quicket.co.za': { mediaRail: '3003989', campaign: '36141' },
    'ticketmaster.com.au': { mediaRail: '1965672', campaign: '24024' },
    'ticketmaster.at': { mediaRail: '1958968', campaign: '23895' },
    'ticketmaster.com.br': { mediaRail: '2127876', campaign: '27025' },
    'ticketmaster.cl': { mediaRail: '2127878', campaign: '27026' },
    'ticketmaster.cz': { mediaRail: '1958979', campaign: '23901' },
    'ticketmaster.dk': { mediaRail: '1958964', campaign: '23893' },
    'ticketmaster.fi': { mediaRail: '1958962', campaign: '23892' },
    'ticketmaster.fr': { mediaRail: '1958960', campaign: '23891' },
    'ticketmaster.de': { mediaRail: '1958958', campaign: '23890' },
    'ticketmaster.gr': { mediaRail: 'XXXXX', campaign: 'YYYYY' },
    'ticketmaster.ie': { mediaRail: '1958956', campaign: '23889' },
    'ticketmaster.it': { mediaRail: '1958975', campaign: '23899' },
    'ticketmaster.com.mx': { mediaRail: '1958981', campaign: '23902' },
    'ticketmaster.nl': { mediaRail: '1958954', campaign: '23888' },
    'ticketmaster.co.nz': { mediaRail: '1965674', campaign: '24025' },
    'ticketmaster.no': { mediaRail: '1958977', campaign: '23900' },
    'ticketmaster.pe': { mediaRail: '2127881', campaign: '27028' },
    'ticketmaster.pl': { mediaRail: '1958971', campaign: '23896' },
    'ticketmaster.ch': { mediaRail: '1958973', campaign: '23898' },
    'ticketmaster.co.za': { mediaRail: '1958983', campaign: '23903' },
    'ticketmaster.es': { mediaRail: '1958952', campaign: '23886' },
    'ticketmaster.se': { mediaRail: '1958950', campaign: '23885' },
    'ticketmaster.com.tr': { mediaRail: '1958996', campaign: '23908' },
    'ticketmaster.ae': { mediaRail: '1958985', campaign: '23904' },
    'ticketmaster.co.uk': { mediaRail: '1965662', campaign: '24023' },
  };

  const sortiraniDomeni = Object.keys(affiliateMape).sort((a, b) => b.length - a.length);
  for (const domen of sortiraniDomeni) {
    if (proveraLinka.includes(domen)) {
      const { mediaRail, campaign } = affiliateMape[domen];
      if (mediaRail === 'XXXXX') return `https://ticketmaster.evyy.net/c/${mojImpactId}/264167/4272?u=${encodeURIComponent(izvorniLink)}`;
      return `https://ticketmaster.evyy.net/c/${mojImpactId}/${mediaRail}/${campaign}?u=${encodeURIComponent(izvorniLink)}`;
    }
  }

  return `https://ticketmaster.evyy.net/c/${mojImpactId}/264167/4272?u=${encodeURIComponent(izvorniLink)}`;
}

export default function ConcertsList({ dataZaPrikaz }: ConcertsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [pendingArtist, setPendingArtist] = useState<string | null>(null);
  const concertRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const foundGroup = (dataZaPrikaz || []).find((group) => group.artist_name.toLowerCase().includes(query));
    if (!foundGroup) {
      alert(`Izvođač "${searchQuery}" nije pronađen.`);
      return;
    }

    const artistIsInSelectedCity = selectedCity === null || foundGroup.events.some(
      (concert) => resolveConcertCity(concert.city, concert.location)?.toLowerCase() === selectedCity.toLowerCase(),
    );
    if (!artistIsInSelectedCity) setSelectedCity(null);
    setPendingArtist(foundGroup.artist_name);
  };

  const cities = useMemo(() => {
    const cityMap = new Map<string, string>();
    (dataZaPrikaz || []).forEach((group) => {
      group.events.forEach((event) => {
        const city = resolveConcertCity(event.city, event.location);
        if (city && !cityMap.has(city.toLowerCase())) cityMap.set(city.toLowerCase(), city);
      });
    });
    return Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b));
  }, [dataZaPrikaz]);

  const activeCity = selectedCity && cities.some((city) => city.toLowerCase() === selectedCity.toLowerCase()) ? selectedCity : null;

  useEffect(() => {
    if (!pendingArtist) return;

    let timeoutId: number | undefined;
    const frameId = window.requestAnimationFrame(() => {
      const element = concertRefs.current[pendingArtist];
      if (!element) {
        setPendingArtist(null);
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-accent-red', 'ring-offset-4', 'ring-offset-paper', 'transition-all');
      timeoutId = window.setTimeout(() => {
        element.classList.remove('ring-2', 'ring-accent-red', 'ring-offset-4', 'ring-offset-paper');
        setPendingArtist(null);
      }, 2000);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [pendingArtist]);

  const filteredData = useMemo(() => {
    if (!activeCity) return dataZaPrikaz || [];
    return (dataZaPrikaz || [])
      .map((group) => ({
        ...group,
        events: group.events.filter((event) => resolveConcertCity(event.city, event.location)?.toLowerCase() === activeCity.toLowerCase()),
      }))
      .filter((group) => group.events.length > 0);
  }, [dataZaPrikaz, activeCity]);

  return (
    <>
      <div className="mx-auto mb-10 max-w-2xl">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 rounded-full border border-line bg-white p-1.5 transition-colors focus-within:border-ink">
          <Search aria-hidden="true" className="ml-3 size-4 shrink-0 text-muted" />
          <label htmlFor="tour-artist-search" className="sr-only">Search artist</label>
          <input id="tour-artist-search" type="search" placeholder="Search artist..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-ink placeholder:text-placeholder focus:outline-none" />
          <button type="submit" className="rounded-full bg-accent-red px-6 py-2.5 text-[10px] font-black tracking-[0.2em] text-white uppercase transition-colors hover:bg-ink">Search</button>
        </form>
      </div>

      {cities.length > 0 && (
        <section aria-labelledby="tour-city-filter" className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 text-accent-blue" />
            <h2 id="tour-city-filter" className="text-xs font-black tracking-[0.24em] text-ink uppercase">Filter by city</h2>
            <span className="text-[9px] font-bold tracking-[0.16em] text-muted uppercase">· {cities.length} markets</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedCity(null)} aria-pressed={activeCity === null} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[10px] font-black tracking-[0.12em] transition-colors ${activeCity === null ? 'border-accent-red bg-accent-red text-white' : 'border-line bg-white text-ink hover:border-ink'}`}>All Cities</button>
            {cities.map((city) => (
              <button key={city} type="button" onClick={() => setSelectedCity(city)} aria-pressed={activeCity === city} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[10px] font-black tracking-[0.12em] transition-colors ${activeCity === city ? 'border-accent-red bg-accent-red text-white' : 'border-line bg-white text-ink hover:border-ink'}`}>{city}</button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="official-tour-dates">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 text-accent-red" /><h2 id="official-tour-dates" className="text-xs font-black tracking-[0.24em] text-ink uppercase">Official tour dates</h2></div>
          <span className="hidden text-[9px] font-bold tracking-[0.16em] text-muted uppercase sm:inline">Tickets via Ticketmaster</span>
        </div>

        {filteredData.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredData.map((group) => (
              <article key={group.artist_name} ref={(element) => { concertRefs.current[group.artist_name] = element; }} className="group flex min-w-0 flex-col overflow-hidden border border-line bg-white transition-colors hover:border-ink">
                <div className="relative h-52 overflow-hidden bg-ink">
                  {group.image_url && <img src={group.image_url} alt={group.artist_name} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />}
                  <div className="mt-image-overlay absolute inset-0" />
                  <div className="absolute inset-x-0 bottom-0 p-5"><p className="mt-meta text-white/60">Official tour</p><h3 className="mt-1.5 line-clamp-2 text-2xl font-black leading-[0.95] tracking-[-0.04em] text-white">{group.artist_name}</h3></div>
                  <span className="absolute right-4 top-4 bg-accent-red px-2.5 py-1 text-[9px] font-black tracking-[0.12em] text-white uppercase">{group.events.length} dates</span>
                </div>
                <ul className="divide-y divide-line">
                  {group.events.map((event) => (
                    <li key={event.id} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-paper-hover">
                      <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-black tracking-tight text-ink tabular-nums">{event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</span><span className="text-[9px] font-bold tracking-widest text-muted uppercase">{event.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' }) : ''}</span></div><p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] leading-tight text-muted"><MapPin aria-hidden="true" className="size-3 shrink-0 text-accent-blue" /><span className="truncate">{event.location}</span></p></div>
                      <a href={generisiAffiliateLink(event.ticket_link)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[9px] font-black tracking-[0.12em] text-white uppercase transition-colors hover:bg-accent-red"><Ticket aria-hidden="true" className="size-3" />Tickets</a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-line bg-paper-muted px-6 py-20 text-center"><p className="text-sm font-bold tracking-[0.14em] text-muted uppercase">{selectedCity ? `No concerts found in ${selectedCity}.` : 'No concerts found for this region.'}</p>{selectedCity && <button type="button" onClick={() => setSelectedCity(null)} className="mt-4 text-xs font-black tracking-[0.12em] text-accent-red uppercase underline underline-offset-4">Clear city filter</button>}</div>
        )}
      </section>
    </>
  );
}
