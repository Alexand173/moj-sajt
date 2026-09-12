'use client';

import Image from 'next/image';
import { Maximize2, MapPin, Pause, Play, Search, Volume2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { HeroItem } from '@/components/ticket-types';

interface TicketHeroProps {
  regionName: string;
  heroItems: HeroItem[];
  searchQuery: string;
  cities: string[];
  activeCity: string | null;
  onSearchChange: (value: string) => void;
  onCityChange: (city: string | null) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function TicketHero({
  regionName,
  heroItems,
  searchQuery,
  cities,
  activeCity,
  onSearchChange,
  onCityChange,
  onSearchSubmit,
}: TicketHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeItem = heroItems[activeIndex] || heroItems[0];
  const regionLabel = regionName.toLowerCase() === 'uk' ? 'the UK' : regionName.toUpperCase();

  if (!activeItem) return null;

  return (
    <section className="border-b border-line bg-paper text-ink">
      <div className="mt-container py-10 sm:py-14 lg:py-16">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="mt-kicker">On the road · 2026</p>
          <p className="mt-meta flex items-center gap-2 text-[9px] text-muted">
            <span className="mt-status-dot" aria-hidden="true" />
            {regionLabel} live desk
          </p>
        </div>

        <div className="relative min-h-[340px] overflow-hidden rounded-[3px] bg-black text-white shadow-[0_16px_40px_rgb(8_9_10_/_0.16)] md:aspect-[3.25/1] md:min-h-0">
          {activeItem.imageUrl && (
            <Image
              src={activeItem.imageUrl}
              alt=""
              fill
              priority={activeIndex === 0}
              sizes="(min-width: 1280px) 1200px, 100vw"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
              className="object-cover opacity-45"
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0_/_0.84),rgb(0_0_0_/_0.22)_56%,rgb(0_0_0_/_0.3)),linear-gradient(0deg,rgb(0_0_0_/_0.85),transparent_58%)]" />

          <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[9px] font-black tracking-[0.16em] uppercase sm:inset-x-6 sm:top-5">
            <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent-red shadow-[0_0_0_4px_rgb(230_57_70_/_0.16)]" /> Live broadcast</span>
            <span className="text-white/65">⌁ MusicTop · Stage 1</span>
          </div>

          <button
            type="button"
            aria-label={isPlaying ? `Pause ${activeItem.artist} live preview` : `Play ${activeItem.artist} live preview`}
            aria-pressed={isPlaying}
            onClick={() => setIsPlaying((playing) => !playing)}
            className="absolute left-1/2 top-[42%] inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 focus-visible:outline-white sm:size-14"
          >
            {isPlaying ? <Pause aria-hidden="true" className="size-5 fill-current" /> : <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />}
          </button>

          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-4 sm:inset-x-6 sm:bottom-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <p className="text-[9px] font-black tracking-[0.24em] text-accent-red uppercase">Now playing</p>
              <p className="mt-1 text-3xl font-black leading-none tracking-[-0.06em] sm:text-4xl">{activeItem.artist}</p>
              <p className="mt-1 text-[11px] text-white/75">{activeItem.title}</p>
              <p className="mt-1 text-[9px] font-bold tracking-[0.12em] text-white/45 uppercase">{activeItem.venue}</p>
            </div>

            <div className="flex items-center gap-3 text-white/70" aria-label="Player controls">
              <Volume2 aria-hidden="true" className="size-3.5" />
              <Maximize2 aria-hidden="true" className="size-3.5" />
            </div>
          </div>

          <div className="absolute bottom-3 left-4 right-14 flex max-w-[min(72%,26rem)] gap-2 overflow-x-auto pb-1 no-scrollbar sm:bottom-4 sm:left-6">
            {heroItems.map((item, index) => (
              <button
                key={`${item.artist}-${index}`}
                type="button"
                aria-label={`Show ${item.artist} live preview`}
                aria-pressed={index === activeIndex}
                onClick={() => {
                  setActiveIndex(index);
                  setIsPlaying(false);
                }}
                className={`relative h-10 min-w-20 overflow-hidden border bg-black/70 px-2 text-left transition-colors sm:h-11 sm:min-w-24 ${index === activeIndex ? 'border-accent-red' : 'border-white/20 hover:border-white/60'}`}
              >
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover opacity-55"
                  />
                )}
                <span className="relative z-10 line-clamp-2 text-[8px] font-black leading-tight text-white">{item.artist}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Explore current live event schedules, verified ticket links and availability across {regionLabel}. Buy official concert tickets for 2026 tours — every date is cross-checked against the promoter&apos;s schedule.
        </p>

        <form onSubmit={onSearchSubmit} className="mt-6 flex flex-col gap-2 rounded-[999px] border border-line bg-white p-1.5 transition-colors focus-within:border-ink sm:flex-row sm:items-center">
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
