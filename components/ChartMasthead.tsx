import Link from 'next/link';
import { Radio } from 'lucide-react';

const GLOBAL_GENRES = [
  { label: 'ROCK', slug: 'rock' },
  { label: 'POP', slug: 'pop' },
  { label: 'HIP-HOP', slug: 'hip-hop' },
  { label: 'R&B/SOUL', slug: 'rb-soul' },
  { label: 'COUNTRY', slug: 'country' },
  { label: 'DANCE', slug: 'dance-electronic' },
] as const;

const EUROPA_GENRES = [
  { label: 'ROCK', slug: 'rock' },
  { label: 'POP', slug: 'pop' },
  { label: 'HIP-HOP', slug: 'hip-hop' },
  { label: 'R&B/SOUL', slug: 'rb-soul' },
  { label: 'METAL', slug: 'metal' },
  { label: 'DANCE', slug: 'dance-electronic' },
] as const;

const ASIA_GENRES = [
  { label: 'J-POP', slug: 'j-pop' },
  { label: 'J-ROCK', slug: 'j-rock-metal' },
  { label: 'K-POP', slug: 'k-pop' },
  { label: 'C-POP', slug: 'c-pop' },
  { label: 'INDIA', slug: 'india' },
  { label: 'OTHER', slug: 'other' },
] as const;

function getGenreOptions(regionName: string, canonicalPath?: string) {
  const normalized = regionName.toLowerCase();
  if (normalized === 'asia' || canonicalPath?.includes('/region/asia/')) return ASIA_GENRES;
  if (normalized === 'europa' || canonicalPath?.includes('/region/europa/')) return EUROPA_GENRES;
  return GLOBAL_GENRES;
}

function getChartBasePath(canonicalPath: string | undefined, genreName: string, regionName: string) {
  if (!canonicalPath) return `/region/${regionName.toLowerCase()}`;
  const path = canonicalPath.replace(/^https?:\/\/[^/]+/, '');
  if (path === '' || path === '/') return `/region/${regionName.toLowerCase()}`;
  const suffix = `/${genreName.toLowerCase()}`;
  return path.endsWith(suffix) ? path.slice(0, -suffix.length) : path;
}

function formatRegion(regionName: string) {
  const normalized = regionName.trim().toLowerCase();
  if (normalized === 'us' || normalized === 'uk') return normalized.toUpperCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export interface ChartMastheadProps {
  regionName: string;
  genreName: string;
  songCount: number;
  canonicalPath?: string;
}

export default function ChartMasthead({
  regionName,
  genreName,
  songCount,
  canonicalPath,
}: ChartMastheadProps) {
  const region = formatRegion(regionName);
  const genres = getGenreOptions(regionName, canonicalPath);
  const chartBasePath = getChartBasePath(canonicalPath, genreName, regionName);
  const normalizedGenre = genreName.toLowerCase();

  return (
    <section className="border-b border-white/10 bg-ink">
      <div className="mt-container py-10 sm:py-14 lg:py-16">
        <div className="flex flex-wrap items-center gap-3">
          <Radio aria-hidden="true" className="size-3.5 text-accent-red" />
          <span className="mt-meta text-white/45">{region} {genreName} · Live chart 2026</span>
          <span className="ml-auto hidden items-center gap-2 text-[9px] font-bold tracking-[0.2em] text-white/45 uppercase sm:flex">
            <span className="mt-status-dot" aria-hidden="true" />
            Updated 4 min ago
          </span>
        </div>

        <h1 className="mt-5 max-w-[1100px] text-balance text-[clamp(3.5rem,10vw,9rem)] font-black leading-[0.82] tracking-[-0.085em] uppercase">
          <span className="text-white">{region} {genreName} </span>
          <span className="bg-gradient-to-r from-accent-red via-[#c33d72] to-accent-blue bg-clip-text text-transparent">Top {songCount || 100}</span>
        </h1>

        <nav aria-label={`${region} chart genres`} className="mt-8 flex min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">
          {genres.map((genre) => {
            const isActive = normalizedGenre === genre.slug;
            const href = chartBasePath ? `${chartBasePath}/${genre.slug}` : '#chart';

            return chartBasePath ? (
              <Link
                key={genre.slug}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[9px] font-black tracking-[0.16em] transition-colors ${isActive ? 'border-accent-red bg-accent-red text-white' : 'border-white/20 text-white/55 hover:border-white/50 hover:text-white'}`}
              >
                {genre.label}
              </Link>
            ) : (
              <span key={genre.slug} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[9px] font-black tracking-[0.16em] ${isActive ? 'border-accent-red bg-accent-red text-white' : 'border-white/20 text-white/55'}`}>
                {genre.label}
              </span>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
