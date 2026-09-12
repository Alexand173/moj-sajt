'use client';

import Image from 'next/image';
import { Play, Radio } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GroupedConcert } from '@/components/ticket-types';

type PreviewItem = {
  artist: string;
  title: string;
  venue: string;
  imageUrl: string | null;
};

const fallbackPreviews: PreviewItem[] = [
  { artist: 'Bruno Mars', title: 'The Romantic Tour · Live Preview', venue: 'Wembley Stadium, London', imageUrl: null },
  { artist: 'Nick Cave & The Bad Seeds', title: 'From the Bad Seeds Archive', venue: 'Preston Park, Brighton', imageUrl: null },
  { artist: 'Jack White', title: 'No Name · Tour Rehearsals', venue: 'Eventim Apollo, London', imageUrl: null },
];

export default function LivePreviewRail({ groups }: { groups: GroupedConcert[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const previews = useMemo(() => fallbackPreviews.map((fallback, index) => {
    const group = groups[index];
    const event = group?.events[0];
    return {
      ...fallback,
      artist: group?.artist_name || fallback.artist,
      venue: event?.location || fallback.venue,
      imageUrl: group?.image_url || fallback.imageUrl,
    };
  }), [groups]);

  return (
    <section aria-labelledby="live-previews" className="border-t border-line bg-paper text-ink">
      <div className="mt-container py-14 sm:py-16 lg:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mt-kicker text-accent-blue"><Radio aria-hidden="true" className="size-3" /> Live previews</p>
            <h2 id="live-previews" className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-5xl">Watch before you buy</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Press play on a real live reel from each tour. See the stage, hear the room, then grab your tickets — no guesswork, just the show.</p>
          </div>
          <span className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] text-muted uppercase"><span className="size-1.5 rounded-full bg-ticket-green" /> Streaming in HD</span>
        </div>

        <div className="mt-7 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 no-scrollbar md:grid md:grid-cols-3 md:overflow-visible">
          {previews.map((preview, index) => {
            const isPlaying = activeIndex === index;
            return (
              <div key={`${preview.artist}-${index}`} className="relative min-w-[82vw] snap-start overflow-hidden bg-gradient-to-br from-ticket-preview-start to-ticket-preview-end px-5 py-5 text-center text-white sm:min-w-[22rem] md:min-w-0 md:px-7 md:py-6">
                {preview.imageUrl && (
                  <Image
                    src={preview.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 82vw"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    className="object-cover opacity-25 mix-blend-screen"
                  />
                )}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgb(255_255_255_/_0.12),transparent_24%),linear-gradient(180deg,transparent,rgb(8_9_10_/_0.42))]" />
                <div className="relative z-10 flex aspect-[1.8/1] flex-col items-center justify-center">
                  <div className="absolute inset-x-0 top-0 flex justify-between text-[8px] font-black tracking-[0.16em] uppercase">
                    <span className="bg-accent-red px-2 py-1">● Live preview</span>
                    <span className="bg-ink/70 px-2 py-1">◉ HD</span>
                  </div>
                  <button
                    type="button"
                    aria-label={isPlaying ? `Pause ${preview.artist} preview` : `Play ${preview.artist} preview`}
                    aria-pressed={isPlaying}
                    onClick={() => setActiveIndex(isPlaying ? null : index)}
                    className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 focus-visible:outline-white"
                  >
                    <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />
                  </button>
                  <p className="mt-4 line-clamp-2 text-xl font-black leading-none tracking-[-0.05em]">{preview.artist}</p>
                  <p className="mt-2 text-[10px] font-bold text-white/70">{preview.title}</p>
                  <p className="mt-2 text-[8px] font-bold tracking-[0.14em] text-white/45 uppercase">{preview.venue}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
