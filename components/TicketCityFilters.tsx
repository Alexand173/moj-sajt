'use client';

import { MapPin } from 'lucide-react';

interface TicketCityFiltersProps {
  cities: string[];
  activeCity: string | null;
  onCityChange: (city: string | null) => void;
}

export default function TicketCityFilters({ cities, activeCity, onCityChange }: TicketCityFiltersProps) {
  if (cities.length === 0) return null;

  return (
    <section aria-labelledby="ticket-city-filter" className="border-b border-line bg-paper text-ink">
      <div className="mt-container py-7 sm:py-8">
        <div className="mb-4 flex items-center gap-2">
          <MapPin aria-hidden="true" className="size-3.5 text-accent-blue" />
          <h2 id="ticket-city-filter" className="text-[10px] font-black tracking-[0.24em] text-ink uppercase">Filter by city</h2>
          <span className="text-[9px] font-bold tracking-[0.16em] text-muted uppercase">· {cities.length} markets</span>
        </div>
        <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 no-scrollbar md:flex-wrap md:overflow-visible">
          <button
            type="button"
            onClick={() => onCityChange(null)}
            aria-pressed={activeCity === null}
            className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[10px] font-black tracking-[0.12em] transition-colors ${activeCity === null ? 'border-accent-red bg-accent-red text-white' : 'border-line bg-white text-ink hover:border-ink'}`}
          >
            All Cities
          </button>
          {cities.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => onCityChange(city)}
              aria-pressed={activeCity === city}
              className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[10px] font-black tracking-[0.12em] transition-colors ${activeCity === city ? 'border-accent-red bg-accent-red text-white' : 'border-line bg-white text-ink hover:border-ink'}`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
