'use client';

import { MapPin, Search } from 'lucide-react';
import type { FormEvent } from 'react';

interface TicketSearchFormProps {
  searchQuery: string;
  cities: string[];
  activeCity: string | null;
  onSearchChange: (value: string) => void;
  onCityChange: (city: string | null) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function TicketSearchForm({
  searchQuery,
  cities,
  activeCity,
  onSearchChange,
  onCityChange,
  onSearchSubmit,
}: TicketSearchFormProps) {
  return (
    <section aria-label="Ticket search" className="border-b border-line bg-paper text-ink">
      <div className="mt-container py-7 sm:py-8">
        <form onSubmit={onSearchSubmit} className="flex flex-col gap-2 rounded-[999px] border border-line bg-white p-1.5 transition-colors focus-within:border-ink sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-line px-2 py-1.5 sm:border-b-0 sm:border-r">
            <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
            <label htmlFor="ticket-artist-search" className="sr-only">Search artist</label>
            <input
              id="ticket-artist-search"
              type="search"
              placeholder="Search artist..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-placeholder focus:outline-hidden"
            />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
            <label htmlFor="ticket-city-search" className="sr-only">Search city</label>
            <select
              id="ticket-city-search"
              aria-label="Search city"
              value={activeCity || ''}
              onChange={(event) => onCityChange(event.target.value || null)}
              className="min-w-0 flex-1 appearance-none bg-transparent text-sm text-ink focus:outline-hidden"
            >
              <option value="">Search city...</option>
              {cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded-full bg-accent-red px-7 py-2.5 text-[10px] font-black tracking-[0.2em] text-white uppercase transition-colors hover:bg-ink">Search</button>
        </form>
      </div>
    </section>
  );
}
