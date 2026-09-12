'use client';

import Image from 'next/image';
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { getYouTubeVideoId } from '@/lib/news-media';
import type { HeroItem } from '@/components/ticket-types';

interface TicketHeroVideoRailProps {
  items: HeroItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export default function TicketHeroVideoRail({
  items,
  activeIndex,
  onSelect,
}: TicketHeroVideoRailProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAndReveal = (index: number) => {
    onSelect(index);
    const target = itemRefs.current[index];
    if (!target) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    if (typeof target.scrollIntoView !== 'function') return;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  };

  const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowLeft'
          ? Math.min(items.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);

    if (nextIndex !== currentIndex) selectAndReveal(nextIndex);
  };

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="On the road videos"
      className="pointer-events-auto absolute inset-x-4 bottom-3 z-20 sm:inset-x-6 sm:bottom-4"
    >
      <div
        role="listbox"
        aria-label="Choose a video"
        dir="rtl"
        className="mt-video-rail flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {items.map((item, index) => {
          const videoId = getYouTubeVideoId(item.videoUrl);
          const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : null;
          const isActive = index === activeIndex;

          return (
            <button
              key={`${item.artist}-${item.videoUrl || index}`}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={`Show ${item.artist} live preview`}
              title={item.artist}
              onClick={() => selectAndReveal(index)}
              onKeyDown={(event) => moveSelection(event, index)}
              dir="ltr"
              style={{ '--mt-video-rail-index': index } as CSSProperties}
              className={`mt-video-rail-item group relative h-14 min-w-28 snap-start overflow-hidden border bg-black/75 px-2.5 text-left transition-[border-color,background-color,transform] duration-200 motion-reduce:animate-none motion-reduce:transition-none sm:h-16 sm:min-w-36 ${isActive ? 'border-accent-red bg-black' : 'border-white/20 hover:border-white/70 hover:bg-black/90'}`}
            >
              {thumbnailUrl ? (
                <Image
                  src={thumbnailUrl}
                  alt=""
                  fill
                  sizes="144px"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  className="object-cover opacity-55 transition-opacity duration-200 group-hover:opacity-75"
                />
              ) : item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="144px"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  className="object-cover opacity-45"
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />
              <span className="relative z-10 flex h-full flex-col justify-end pb-1.5">
                <span className="line-clamp-2 text-[8px] font-black leading-tight text-white">{item.artist}</span>
                <span className="mt-0.5 truncate text-[7px] font-bold tracking-[0.04em] text-white/60">{videoId ? 'YouTube video' : item.title}</span>
              </span>
              {videoId && <span aria-hidden="true" className="absolute left-2 top-2 size-1.5 rounded-full bg-accent-red shadow-[0_0_0_3px_rgb(230_57_70_/_0.2)]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
