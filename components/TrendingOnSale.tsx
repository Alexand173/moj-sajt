'use client';

const fallbackArtists = [
  'Bruno Mars',
  'Nick Cave',
  'Jack White',
  'OMD',
  'Eagles',
  'JAY-Z',
  'Metallica',
  'Arctic Monkeys',
  'Dua Lipa',
  'Sam Fender',
  'The Cure',
  'Olivia Rodrigo',
  'Bring Me The Horizon',
  'Fred again..',
];

interface TrendingOnSaleProps {
  artists: string[];
  onArtistSelect: (artist: string) => void;
}

export default function TrendingOnSale({ artists, onArtistSelect }: TrendingOnSaleProps) {
  const items = Array.from(new Set([...artists, ...fallbackArtists])).slice(0, 16);

  return (
    <section aria-labelledby="trending-on-sale" className="border-y border-line bg-paper-muted text-ink">
      <div className="mt-container py-10 sm:py-12">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-ticket-green" aria-hidden="true">⌁</span>
          <h2 id="trending-on-sale" className="text-[10px] font-black tracking-[0.24em] text-ink uppercase">Trending on-sale this week</h2>
        </div>
        <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 no-scrollbar md:flex-wrap md:overflow-visible">
          {items.map((artist) => (
            <button
              key={artist}
              type="button"
              onClick={() => onArtistSelect(artist)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-[10px] font-black tracking-tight text-ink transition-colors hover:border-accent-red hover:text-accent-red focus-visible:border-accent-red"
            >
              <span className="size-1 rounded-full bg-accent-red" aria-hidden="true" />
              {artist}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
