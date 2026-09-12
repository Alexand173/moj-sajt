'use client';

import Image from 'next/image';
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { getYouTubeVideoId } from '@/lib/news-media';
import type { HeroItem } from '@/components/ticket-types';

export type TicketHeroVideoRailVariant = 'source-monitor' | 'ticket-strip' | 'liner-index';

interface TicketHeroVideoRailProps {
  items: HeroItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  variant?: TicketHeroVideoRailVariant;
}

interface RailCardProps {
  item: HeroItem;
  index: number;
  active: boolean;
  videoId: string | null;
  setRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  totalCount: number;
}

function RailThumbnail({ item, videoId }: Pick<RailCardProps, 'item' | 'videoId'>) {
  const source = videoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
    : item.imageUrl;

  if (!source) return null;

  return (
    <Image
      src={source}
      alt=""
      fill
      sizes="64px"
      onError={(event) => { event.currentTarget.style.display = 'none'; }}
      className="mt-video-rail__image"
    />
  );
}

function RailButtonFrame({
  item,
  index,
  active,
  setRef,
  onSelect,
  onKeyDown,
  totalCount,
  children,
  className,
}: RailCardProps & { children: ReactNode; className: string }) {
  return (
    <button
      ref={setRef}
      type="button"
      role="option"
      aria-selected={active}
      aria-posinset={index + 1}
      aria-setsize={totalCount}
      aria-label={`Show ${item.artist} live preview`}
      title={item.artist}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      dir="ltr"
      style={{ '--mt-video-rail-index': index } as CSSProperties}
      className={`mt-video-rail-item ${className} ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );
}

function SourceMonitorCard(props: RailCardProps) {
  const { item, videoId } = props;

  return (
    <RailButtonFrame {...props} className="mt-video-rail-item--source-monitor">
      <span aria-hidden="true" className="mt-video-rail__active-rule" />
      <span className="mt-video-rail__thumb mt-video-rail__thumb--source-monitor">
        <RailThumbnail item={item} videoId={videoId} />
        {videoId && <span aria-hidden="true" className="mt-video-rail__dot" />}
      </span>
      <span className="mt-video-rail__copy mt-video-rail__copy--source-monitor">
        <span className="mt-video-rail__artist">{item.artist}</span>
        <span className="mt-video-rail__source">{videoId ? 'YouTube video' : item.title}</span>
      </span>
    </RailButtonFrame>
  );
}

function TicketStripCard(props: RailCardProps) {
  const { item, videoId } = props;

  return (
    <RailButtonFrame {...props} className="mt-video-rail-item--ticket-strip">
      <span className="mt-video-rail__thumb mt-video-rail__thumb--ticket-strip">
        <RailThumbnail item={item} videoId={videoId} />
        {videoId && <span aria-hidden="true" className="mt-video-rail__dot" />}
      </span>
      <span aria-hidden="true" className="mt-video-rail__seam" />
      <span className="mt-video-rail__copy mt-video-rail__copy--ticket-strip">
        <span className="mt-video-rail__artist">{item.artist}</span>
        <span className="mt-video-rail__source">{videoId ? 'YouTube video' : item.title}</span>
      </span>
      {props.active && <span aria-hidden="true" className="mt-video-rail__punch" />}
    </RailButtonFrame>
  );
}

function LinerIndexCard(props: RailCardProps) {
  const { item, videoId } = props;

  return (
    <RailButtonFrame {...props} className="mt-video-rail-item--liner-index">
      <span className="mt-video-rail__thumb mt-video-rail__thumb--liner-index">
        <RailThumbnail item={item} videoId={videoId} />
        {props.active && <span aria-hidden="true" className="mt-video-rail__thumb-rule" />}
      </span>
      <span className="mt-video-rail__copy mt-video-rail__copy--liner-index">
        <span className="mt-video-rail__artist">{item.artist}</span>
        <span className="mt-video-rail__source">{videoId ? 'YouTube video' : item.title}</span>
      </span>
      <span aria-hidden="true" className="mt-video-rail__corner" />
    </RailButtonFrame>
  );
}

export default function TicketHeroVideoRail({
  items,
  activeIndex,
  onSelect,
  variant = 'source-monitor',
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

  const railLabel = variant === 'source-monitor'
    ? `Video sources · ${items.length} available`
    : variant === 'ticket-strip'
      ? 'Official source rail'
      : 'Official source index';
  const railHint = variant === 'liner-index' ? 'Swipe for more' : null;
  const listLabel = variant === 'source-monitor' ? 'Choose an on the road video' : 'Choose a video';

  return (
    <div
      role="region"
      aria-label="On the road videos"
      className={`mt-video-rail-region mt-video-rail-region--${variant}`}
    >
      <div className="mt-video-rail-heading">
        <span className="mt-video-rail-heading__label">{railLabel}</span>
        {railHint && <span className="mt-video-rail-heading__hint">{railHint}</span>}
      </div>
      <div className="mt-video-rail-viewport">
        <div
          role="listbox"
          aria-label={listLabel}
          dir="rtl"
          className={`mt-video-rail mt-video-rail--${variant}`}
        >
          {items.map((item, index) => {
            const videoId = getYouTubeVideoId(item.videoUrl);
            const cardProps: RailCardProps = {
              item,
              index,
              active: index === activeIndex,
              videoId,
              setRef: (node) => { itemRefs.current[index] = node; },
              onSelect: () => selectAndReveal(index),
              onKeyDown: (event) => moveSelection(event, index),
              totalCount: items.length,
            };

            if (variant === 'ticket-strip') return <TicketStripCard key={`${item.artist}-${item.videoUrl || index}`} {...cardProps} />;
            if (variant === 'liner-index') return <LinerIndexCard key={`${item.artist}-${item.videoUrl || index}`} {...cardProps} />;
            return <SourceMonitorCard key={`${item.artist}-${item.videoUrl || index}`} {...cardProps} />;
          })}
        </div>
        <span aria-hidden="true" className="mt-video-rail__fade">
          <span className="mt-video-rail__arrow">‹</span>
        </span>
      </div>
    </div>
  );
}
