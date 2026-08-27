'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, LayoutGrid, Menu, Trophy, X } from 'lucide-react';
import HeaderAuth from '@/components/HeaderAuth';
import { EUROPA_SUBREGIONS } from '@/lib/region-navigation';

export default function Header() {
  const pathname = usePathname();
  const [isImmersive, setIsImmersive] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pathSegments = pathname.split('/').filter(Boolean);
  const currentRegion = pathSegments[1] || 'us';
  const currentEuropaSubregion = currentRegion === 'europa'
    && EUROPA_SUBREGIONS.some((subregion) => subregion.slug === pathSegments[2])
    ? pathSegments[2]
    : null;
  const currentGenre = currentEuropaSubregion ? pathSegments[3] : pathSegments[2];

  const isHome = pathname === '/';
  const isNewsPage = pathname.startsWith('/news');
  const isReviewsPage = pathname.startsWith('/reviews');
  const isToursPage = pathname.startsWith('/tours');
  const isFestivalsPage = pathname.startsWith('/festivals');
  const isAwardsPage = pathname.startsWith('/awards');
  const isRegionPage = pathname.startsWith('/region');

  const pages = [
    { name: 'NEWS', href: '/news/us' },
    { name: 'TOURS', href: '/tours/us' },
    { name: 'FESTIVALS', href: '/festivals/us' },
    { name: 'REVIEWS', href: '/reviews' },
    { name: 'MTA', href: '/awards' },
  ];

  const regions = [
    { name: 'US', slug: 'us' },
    { name: 'UK', slug: 'uk' },
    { name: 'EUROPA', slug: 'europa' },
    { name: 'LATINO', slug: 'latino' },
    { name: 'ASIA', slug: 'asia' },
    { name: 'WORLD', slug: 'world' },
    { name: 'JAZZ', slug: 'jazz' },
    { name: 'CLASSICAL', slug: 'classical' },
  ];

  const globalGenres = [
    { name: 'ROCK', slug: 'rock' },
    { name: 'POP', slug: 'pop' },
    { name: 'HIP-HOP', slug: 'hip-hop' },
    { name: 'R&B/SOUL', slug: 'rb-soul' },
    { name: 'COUNTRY', slug: 'country' },
    { name: 'DANCE', slug: 'dance-electronic' },
  ];

  const europaGenres = [
    { name: 'ROCK', slug: 'rock' },
    { name: 'POP', slug: 'pop' },
    { name: 'HIP-HOP', slug: 'hip-hop' },
    { name: 'R&B/SOUL', slug: 'rb-soul' },
    { name: 'METAL', slug: 'metal' },
    { name: 'DANCE', slug: 'dance-electronic' },
  ];

  const asiaGenres = [
    { name: 'J-POP', slug: 'j-pop' },
    { name: 'J-ROCK', slug: 'j-rock-metal' },
    { name: 'K-POP', slug: 'k-pop' },
    { name: 'C-POP', slug: 'c-pop' },
    { name: 'INDIA', slug: 'india' },
    { name: 'OTHER', slug: 'other' },
  ];

  const getBasePath = () => {
    if (pathname.includes('/news')) return 'news';
    if (pathname.includes('/tours')) return 'tours';
    if (pathname.includes('/festivals')) return 'festivals';
    return 'region';
  };

  const showRegions = isHome || isNewsPage || isToursPage || isFestivalsPage || isRegionPage || isReviewsPage || isAwardsPage;
  const showGenres = isRegionPage && pathSegments.length < 3;
  const showEuropaSubregions = isRegionPage && currentRegion === 'europa';
  const isAsia = currentRegion === 'asia';
  const isEuropa = currentRegion === 'europa';
  const activeGenres = isAsia ? asiaGenres : isEuropa ? europaGenres : globalGenres;

  const logoIsActive = isHome || (pathname.startsWith('/region/')
    && !pathname.includes('/news')
    && !pathname.includes('/reviews')
    && !pathname.includes('/festivals')
    && !pathname.includes('/tours'));

  return (
    <header className="fixed inset-x-0 top-0 z-[100] bg-ink text-white shadow-[0_1px_0_rgb(255_255_255_/_0.08)]">
      <div className="mt-container">
        <div className="flex min-h-7 items-center justify-between border-b border-white/10 text-[9px] font-bold tracking-[0.25em] text-white/45 uppercase">
          <span className="flex items-center gap-2">
            <span className="mt-status-dot" aria-hidden="true" />
            Live · <span className="tabular-nums">{currentTime || '--:--:--'} UTC</span>
          </span>
          <div className="hidden items-center gap-6 md:flex">
            <span>Issue Nº 0842</span>
            <span>Wed · 26.08.2026</span>
          </div>
        </div>

        <div className="flex min-h-[4.75rem] items-center gap-4 py-3 lg:gap-8">
          <Link
            href="/"
            aria-label="MUSIC TOP home"
            className={`shrink-0 text-[1.65rem] font-black leading-none tracking-[-0.09em] transition-opacity hover:opacity-80 sm:text-3xl ${logoIsActive ? 'text-white' : 'text-white/85'}`}
          >
            MUSIC<span className="text-accent-red">TOP</span>
          </Link>

          <nav aria-label="Primary navigation" className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex xl:gap-8">
            {pages.map((page) => {
              const isActive = pathname.startsWith(`/${page.href.split('/')[1]}`);
              return (
                <Link
                  key={page.name}
                  href={page.href}
                  className={`group relative inline-flex items-center gap-1.5 whitespace-nowrap py-3 text-[10px] font-black tracking-[0.2em] transition-colors ${isActive ? 'text-white' : 'text-white/55 hover:text-white'}`}
                >
                  {page.name}
                  {page.name === 'MTA' && <Trophy aria-hidden="true" className="size-3 text-accent-red" />}
                  <span className={`absolute inset-x-0 bottom-0 h-px bg-accent-red transition-transform duration-300 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1 rounded-full border border-white/15 p-0.5 md:flex">
              <button
                type="button"
                aria-pressed={!isImmersive}
                onClick={() => setIsImmersive(false)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-black tracking-[0.15em] transition-colors ${!isImmersive ? 'bg-white text-ink' : 'text-white/50 hover:text-white'}`}
              >
                <LayoutGrid aria-hidden="true" className="size-3" />
                Scan
              </button>
              <button
                type="button"
                aria-pressed={isImmersive}
                onClick={() => setIsImmersive(true)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-black tracking-[0.15em] transition-colors ${isImmersive ? 'bg-accent-red text-white' : 'text-white/50 hover:text-white'}`}
              >
                <Eye aria-hidden="true" className="size-3" />
                Immersive
              </button>
            </div>

            <div className="shrink-0">
              <HeaderAuth />
            </div>

            <button
              type="button"
              aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-primary-navigation"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              className="inline-flex size-9 items-center justify-center border border-white/20 text-white transition-colors hover:border-accent-red hover:text-accent-red lg:hidden"
            >
              {isMobileNavOpen ? <X aria-hidden="true" className="size-4" /> : <Menu aria-hidden="true" className="size-4" />}
            </button>
          </div>
        </div>

        {isMobileNavOpen && (
          <nav id="mobile-primary-navigation" aria-label="Mobile primary navigation" className="border-t border-white/10 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
              {pages.map((page) => {
                const isActive = pathname.startsWith(`/${page.href.split('/')[1]}`);
                return (
                  <Link
                    key={page.name}
                    href={page.href}
                    onClick={() => setIsMobileNavOpen(false)}
                    className={`border border-white/10 px-3 py-3 text-center text-[10px] font-black tracking-[0.18em] transition-colors ${isActive ? 'border-accent-red bg-accent-red text-white' : 'text-white/65 hover:border-white/40 hover:text-white'}`}
                  >
                    {page.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {showRegions && (
        <div className="border-t border-line bg-paper text-ink">
          <div className="mt-container flex min-w-0 items-center gap-3 overflow-x-auto py-2 no-scrollbar">
            <nav aria-label="Regions" className="flex min-w-max items-center gap-1 sm:gap-2">
              {regions.map((region) => {
                const isActive = pathname.includes(`/${region.slug}`);
                const base = getBasePath();
                let finalHref = '';

                if (base === 'festivals') {
                  finalHref = `/festivals/${region.slug}`;
                } else if (base === 'region') {
                  const defaultGenre = region.slug === 'asia' ? 'j-pop' : 'rock';
                  finalHref = region.slug === 'europa'
                    ? `/region/europa/germany/${defaultGenre}`
                    : `/region/${region.slug}/${defaultGenre}`;
                } else {
                  finalHref = `/${base}/${region.slug}`;
                }

                return (
                  <Link
                    key={region.slug}
                    href={finalHref}
                    className={`relative whitespace-nowrap px-3 py-1.5 text-[9px] font-black tracking-[0.2em] transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}
                  >
                    {region.name}
                    <span className={`absolute inset-x-3 bottom-0 h-0.5 bg-accent-red transition-transform duration-300 ${isActive ? 'scale-x-100' : 'scale-x-0'}`} />
                  </Link>
                );
              })}
            </nav>
            <span className="ml-auto hidden shrink-0 items-center gap-2 border-l border-line pl-4 text-[9px] font-bold tracking-[0.2em] text-muted uppercase md:flex">
              <span className="size-1.5 rounded-full bg-accent-blue" aria-hidden="true" />
              12 Stories Streaming
            </span>
          </div>
        </div>
      )}

      {showEuropaSubregions && (
        <div className="border-t border-line-strong bg-paper-muted text-ink">
          <nav aria-label="Europa subregions" className="mt-container flex min-w-max items-center justify-center gap-1 overflow-x-auto py-2 no-scrollbar sm:gap-3">
            {EUROPA_SUBREGIONS.map((subregion) => {
              const activeGenre = currentGenre || 'rock';
              const isActive = currentEuropaSubregion === subregion.slug;
              return (
                <Link
                  key={subregion.slug}
                  href={`/region/europa/${subregion.slug}/${activeGenre}`}
                  className={`relative whitespace-nowrap px-2 py-1 text-[9px] font-black tracking-[0.16em] transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {subregion.name}
                  <span className={`absolute inset-x-2 bottom-0 h-0.5 bg-accent-red transition-transform duration-300 ${isActive ? 'scale-x-100' : 'scale-x-0'}`} />
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {showGenres && (
        <div className="border-t border-white/10 bg-ink text-white">
          <nav aria-label="Genres" className="mt-container flex min-w-max items-center justify-center gap-2 overflow-x-auto py-2.5 no-scrollbar sm:gap-3">
            {activeGenres.map((genre) => {
              const isActive = pathname.includes(genre.slug) || (isHome && genre.slug === 'rock');
              const genreHref = currentEuropaSubregion
                ? `/region/europa/${currentEuropaSubregion}/${genre.slug}`
                : `/region/${currentRegion}/${genre.slug}`;

              return (
                <Link
                  key={genre.slug}
                  href={genreHref}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-[9px] font-black tracking-[0.14em] transition-colors ${isActive ? 'border-accent-red bg-accent-red text-white' : 'border-white/15 text-white/50 hover:border-white/45 hover:text-white'}`}
                >
                  {genre.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
