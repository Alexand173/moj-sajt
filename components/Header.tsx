'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HeaderAuth from '@/components/HeaderAuth';


export default function Header() {
  const pathname = usePathname();

  // 1. Definicije stranica
  const isHome = pathname === '/';
  const isNewsPage = pathname.startsWith('/news');
  const isReviewsPage = pathname.startsWith('/reviews'); 
  const isToursPage = pathname.startsWith('/tours');
  const isFestivalsPage = pathname.startsWith('/festivals');
  const isAwardsPage = pathname.startsWith('/awards');
  const isRegionPage = pathname.startsWith('/region');

  // 2. Podaci za navigaciju
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
    { name: 'CLASSICAL', slug: 'classical' }
  ];

  const globalGenres = [
    { name: 'ROCK', slug: 'rock' },
    { name: 'POP', slug: 'pop' },
    { name: 'HIP-HOP', slug: 'hip-hop' },
    { name: 'R&B/SOUL', slug: 'rb-soul' },
    { name: 'COUNTRY', slug: 'country' },
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

  // 3. Pomoćne funkcije za dinamiku
  const getBasePath = () => {
    if (pathname.includes('/news')) return 'news';
    if (pathname.includes('/tours')) return 'tours';
    if (pathname.includes('/festivals')) return 'festivals'; 
    return 'region'; 
  };

  const showRegions = isHome || isNewsPage || isToursPage || isFestivalsPage || isRegionPage;
  const showGenres = isHome || isRegionPage;
  const isAsia = pathname.includes('/asia');

  return (
    <header className="fixed top-0 left-0 w-full z-[100] bg-black border-b border-white/10">
      
{/* RED 1: LOGO, GLAVNI MENI I AUTH (Potpuno bezbedan za klikove i centriran) */}
<div className="w-full border-b border-white/5 bg-black relative z-[50]">
  <div className="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap md:flex-nowrap items-center justify-center gap-x-6 gap-y-2 relative z-[60]">
    
    {/* ZAJEDNIČKI CENTRIRANI NIZ - SADA DOZVOLJAVA PROLAZ KLIKOVA */}
    <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-x-5 gap-y-2 min-w-0 pointer-events-auto relative z-[70]">
      
      {/* 1. LOGO */}
      <Link href="/" className="text-xl md:text-2xl font-black italic tracking-tighter uppercase transition-colors shrink-0 relative z-[80]">
        <span className={
          pathname === "/" || (pathname.startsWith("/region/") && !pathname.includes("/news") && !pathname.includes("/reviews") && !pathname.includes("/festivals") && !pathname.includes("/tours")) 
          ? "text-white" 
          : "text-zinc-400"
        }>
          MUSIC
        </span>
        <span className={
          pathname === "/" || (pathname.startsWith("/region/") && !pathname.includes("/news") && !pathname.includes("/reviews") && !pathname.includes("/festivals") && !pathname.includes("/tours")) 
          ? "text-purple-600" 
          : "text-white"
        }>
          TOP
        </span>
      </Link>

      {/* 2. NAVIGACIJA */}
      <nav className="flex items-center gap-3 md:gap-5 overflow-x-auto no-scrollbar py-1 shrink min-w-0 relative z-[80]">
        {pages.map((p) => {
          const isActive = pathname.startsWith(`/${p.href.split('/')[1]}`);
          return (
            <Link 
              key={p.name} 
              href={p.href} 
              className={`text-[10px] font-black tracking-tighter whitespace-nowrap transition-all ${
                isActive ? 'text-purple-500' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {p.name === 'MTA' && "🏆 "}
              {p.name}
            </Link>
          );
        })}
      </nav>

      {/* 3. AUTH DEO - IZVUČEN NA NAJVIŠI SLOJ DA BI KLIK RADEO 100% */}
      <div className="shrink-0 border-l border-white/10 pl-4 md:pl-5 relative z-[999] pointer-events-auto">
        <HeaderAuth />
      </div>

    </div>

  </div>
</div>

      {/* 2. RED: REGIONI */}
      {showRegions && (
        <div className="bg-zinc-900/50 border-t border-white/5 py-2 overflow-x-auto">
          <div className="flex justify-center gap-4 md:gap-8 px-6 min-w-max">
            {regions.map((r) => {
              const isActive = pathname.includes(`/${r.slug}`);
              const base = getBasePath();
              
              let finalHref = '';

              if (base === 'festivals') {
                finalHref = `/festivals/${r.slug}`;
              } else if (base === 'region') {
                const defaultGenre = r.slug === 'asia' ? 'j-pop' : 'rock';
                finalHref = `/region/${r.slug}/${defaultGenre}`;
              } else {
                finalHref = `/${base}/${r.slug}`;
              }

              return (
                <Link 
                  key={r.slug} 
                  href={finalHref}
                  className={`text-[10px] font-bold tracking-widest px-3 py-1 transition-all ${
                    isActive ? 'text-white border-b-2 border-purple-500' : 'text-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {r.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* RED 3: ŽANROVI */}
      {showGenres && (
        <div className="bg-black border-t border-white/5 py-3">
          <div className="flex flex-wrap justify-center gap-4 px-4">
            {(isAsia ? asiaGenres : globalGenres).map((g) => {
              const currentRegion = pathname.split('/')[2] || 'us';
              const isActive = pathname.includes(g.slug) || (isHome && g.slug === 'rock');
              
              return (
                <Link 
                  key={g.slug} 
                  href={`/region/${currentRegion}/${g.slug}`}
                  className={`text-[9px] font-bold border px-4 py-1 transition-all uppercase ${
                    isActive 
                      ? 'border-purple-500 text-white bg-purple-500/10' 
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                  }`}
                >
                  {g.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}