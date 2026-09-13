'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';

const SLIDE_INTERVAL_MS = 30_000;
const MAX_SLIDES = 5;

interface TourProfileHeroSlideshowProps {
  artistName: string;
  images: string[];
}

export default function TourProfileHeroSlideshow({ artistName, images }: TourProfileHeroSlideshowProps) {
  const slides = useMemo(
    () => Array.from(new Set(images.filter(Boolean))).slice(0, MAX_SLIDES),
    [images],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = Math.min(activeIndex, Math.max(slides.length - 1, 0));

  useEffect(() => {
    if (slides.length < 2) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={`${artistName} tour images`}
      aria-roledescription="carousel"
      className="absolute inset-0 bg-ink"
    >
      {slides.map((imageUrl, index) => (
        <img
          key={imageUrl}
          src={imageUrl}
          alt={index === safeActiveIndex ? `${artistName} tour image ${index + 1}` : ''}
          aria-hidden={index !== safeActiveIndex}
          loading={index === 0 ? 'eager' : 'lazy'}
          decoding="async"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
          className={`absolute inset-0 h-full w-full object-cover grayscale transition-opacity duration-1000 ${index === safeActiveIndex ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(8_9_10),rgb(8_9_10_/_0.62)_48%,rgb(8_9_10_/_0.18))]" />
      {slides.length > 1 && (
        <div className="absolute inset-x-6 top-6 z-10 flex gap-1.5 sm:inset-x-10 sm:top-8 lg:inset-x-16" aria-hidden="true">
          {slides.map((imageUrl, index) => (
            <span
              key={imageUrl}
              className={`h-0.5 transition-all duration-500 ${index === safeActiveIndex ? 'w-12 bg-accent-red' : 'w-5 bg-white/45'}`}
            />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        Showing tour image {safeActiveIndex + 1} of {slides.length} for {artistName}.
      </p>
    </div>
  );
}
