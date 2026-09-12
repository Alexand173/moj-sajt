'use client';

import Image from 'next/image';
import { Maximize2, Pause, Play, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { getYouTubeEmbedUrl, getYouTubeVideoId, getYouTubeWatchUrl } from '@/lib/news-media';
import type { HeroItem } from '@/components/ticket-types';

interface TicketHeroProps {
  regionName: string;
  heroItems: HeroItem[];
}

export default function TicketHero({
  regionName,
  heroItems,
}: TicketHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failedVideoId, setFailedVideoId] = useState<string | null>(null);
  const activeItem = heroItems[activeIndex] || heroItems[0];
  const regionLabel = regionName.toLowerCase() === 'uk' ? 'the UK' : regionName.toUpperCase();

  if (!activeItem) return null;

  const videoId = getYouTubeVideoId(activeItem.videoUrl);
  const isVideoAvailable = Boolean(videoId && failedVideoId !== videoId);
  const videoWatchUrl = videoId ? getYouTubeWatchUrl(videoId) : null;

  const selectHeroItem = (index: number) => {
    setActiveIndex(index);
    setIsPlaying(false);
    setFailedVideoId(null);
  };

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
          {isVideoAvailable && videoId ? (
            <iframe
              key={videoId}
              src={getYouTubeEmbedUrl(videoId)}
              title={`Official ${activeItem.artist} tour video`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => setFailedVideoId(videoId)}
              className="absolute inset-0 z-0 h-full w-full border-0"
            />
          ) : activeItem.imageUrl ? (
            <Image
              src={activeItem.imageUrl}
              alt=""
              fill
              priority={activeIndex === 0}
              sizes="(min-width: 1280px) 1200px, 100vw"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
              className="object-cover opacity-45"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgb(0_0_0_/_0.84),rgb(0_0_0_/_0.22)_56%,rgb(0_0_0_/_0.3)),linear-gradient(0deg,rgb(0_0_0_/_0.85),transparent_58%)]" />

          <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-center justify-between text-[9px] font-black tracking-[0.16em] uppercase sm:inset-x-6 sm:top-5">
            <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent-red shadow-[0_0_0_4px_rgb(230_57_70_/_0.16)]" /> Live broadcast</span>
            <span className="text-white/65">⌁ MusicTop · Stage 1</span>
          </div>

          {isVideoAvailable ? null : failedVideoId && videoWatchUrl ? (
            <div className="absolute left-1/2 top-[42%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center">
              <span className="text-[10px] font-black tracking-[0.18em] text-white/70 uppercase">Video source unavailable</span>
              <a
                href={videoWatchUrl}
                target="_blank"
                rel="noreferrer"
                className="border border-white/40 bg-black/60 px-4 py-2 text-[9px] font-black tracking-[0.14em] text-white uppercase transition-colors hover:border-white hover:bg-white hover:text-ink focus-visible:outline-white"
              >
                Open video on YouTube
              </a>
            </div>
          ) : (
            <button
              type="button"
              aria-label={isPlaying ? `Pause ${activeItem.artist} live preview` : `Play ${activeItem.artist} live preview`}
              aria-pressed={isPlaying}
              onClick={() => setIsPlaying((playing) => !playing)}
              className="absolute left-1/2 top-[42%] z-20 inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 focus-visible:outline-white sm:size-14"
            >
              {isPlaying ? <Pause aria-hidden="true" className="size-5 fill-current" /> : <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />}
            </button>
          )}

          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex flex-col gap-4 sm:inset-x-6 sm:bottom-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <p className="text-[9px] font-black tracking-[0.24em] text-accent-red uppercase">Now playing</p>
              <p className="mt-1 text-3xl font-black leading-none tracking-[-0.06em] sm:text-4xl">{activeItem.artist}</p>
              <p className="mt-1 text-[11px] text-white/75">{activeItem.title}</p>
              <p className="mt-1 text-[9px] font-bold tracking-[0.12em] text-white/45 uppercase">{activeItem.venue}</p>
            </div>

            {!isVideoAvailable && (
              <div className="flex items-center gap-3 text-white/70" aria-label="Player controls">
                <Volume2 aria-hidden="true" className="size-3.5" />
                <Maximize2 aria-hidden="true" className="size-3.5" />
              </div>
            )}
          </div>

          <div className="absolute bottom-3 left-4 right-14 z-20 flex max-w-[min(72%,26rem)] gap-2 overflow-x-auto pb-1 no-scrollbar sm:bottom-4 sm:left-6">
            {heroItems.map((item, index) => (
              <button
                key={`${item.artist}-${index}`}
                type="button"
                aria-label={`Show ${item.artist} live preview`}
                aria-pressed={index === activeIndex}
                onClick={() => selectHeroItem(index)}
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

      </div>
    </section>
  );
}
