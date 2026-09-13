'use client';

/* eslint-disable @next/next/no-img-element */

import { Building2, MapPin } from 'lucide-react';
import { useState } from 'react';
import type { TourVenue } from '@/lib/tour-profile-core';

interface VenuePreviewCardProps {
  venue: TourVenue;
  index: number;
}

export default function VenuePreviewCard({ venue, index }: VenuePreviewCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const previewId = `venue-preview-${index}`;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={previewId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-28 w-full items-start gap-3 border border-line bg-white p-5 text-left transition-colors hover:border-accent-blue focus-visible:border-accent-blue"
      >
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-blue" />
        <span className="min-w-0">
          <span className="block text-sm font-black tracking-tight text-ink">{venue.name}</span>
          <span className="mt-1 block text-xs text-muted">{venue.city}</span>
          <span className="mt-2 block text-[9px] font-black tracking-[0.16em] text-accent-blue uppercase">
            {isOpen ? 'Close venue details' : 'View venue details'} →
          </span>
        </span>
      </button>

      <div
        id={previewId}
        hidden={!isOpen}
        className="mt-tour-profile__venue-preview absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden border border-line bg-white shadow-[12px_12px_0_var(--mt-accent-blue)]"
      >
        {venue.imageUrl ? (
          <img src={venue.imageUrl} alt={venue.name} loading="lazy" decoding="async" className="h-36 w-full object-cover grayscale" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-ink text-white/50">
            <Building2 aria-hidden="true" className="size-8" />
          </div>
        )}
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black tracking-[0.18em] text-accent-red uppercase">Venue guide</p>
            {venue.capacity && <span className="text-[9px] font-bold tracking-[0.12em] text-muted uppercase">{venue.capacity}</span>}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{venue.info}</p>
          {venue.imageSourceUrl && venue.imageSourceName && (
            <a
              href={venue.imageSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-[8px] font-bold tracking-[0.12em] text-muted uppercase underline underline-offset-2 hover:text-ink"
            >
              Image: {venue.imageSourceName} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
