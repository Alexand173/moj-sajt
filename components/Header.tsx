'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

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
    { name: 'LATINO', slug: 'latino' },
    { name: 'ASIA', slug: 'asia' },
    { name: 'EUROPA', slug: 'europa' },
    { name: 'WORLD', slug: 'world' }
  ];

  const genres = [
    { name: 'ROCK', slug: 'rock' },
    { name: 'POP', slug: 'pop' },
    { name: 'HIPHOP', slug: 'hip-hop' },
    { name: 'ELECTRONIC', slug: 'electronic' },
  ];

  // Pomoćna funkcija da odredi bazu (news, tours, festivals...)
  const getBasePath = () => {
    if (isNewsPage) return 'news';
    if (isToursPage) return 'tours';
    if (isFestivalsPage) return 'festivals';
    if (isRegionPage) return 'region';
    return '';
  };

  const basePath = getBasePath();

  return (
    <header className="fixed top-0 left-0 w-full z-[100] bg-black border-b border-white/10">
      
      {/* 1. RED: LOGO I GLAVNE STRANICE */}
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <Link href="/" className="text-3xl font-black italic tracking-tighter text-white">
          MUSIC<span className="text-purple-400">TOP</span>
        </Link>

        <nav className="flex items-center gap-6 md:gap-8 flex-wrap justify-center">
          {pages.map((p) => {
            const isActive = pathname.startsWith(p.href.split('/')[1] === 'reviews' || p.href.split('/')[1] === 'awards' ? p.href : `/${p.href.split('/')[1]}`);
            return (
              <Link 
                key={p.name} 
                href={p.href} 
                className={`text-[11px] font-black tracking-[0.2em] flex items-center gap-2 transition-all ${isActive ? 'text-purple-500 drop-shadow-[0_0_8px_rgba(147,51,234,0.6)]' : 'text-zinc-500 hover:text-white'}`}
              >
                {p.name === 'MTA' && <span className="text-base shadow-purple-500/50 drop-shadow-md">🏆</span>}
                {p.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 2. RED: REGIONI (Prikazuje se na News, Tours, Festivals) */}
      {(isNewsPage || isToursPage || isFestivalsPage) && (
        <div className="bg-zinc-900/50 border-t border-white/5 py-2 overflow-x-auto">
          <div className="flex justify-center gap-4 md:gap-8 px-6 min-w-max">
            {regions.map((r) => {
              const isActive = pathname.includes(`/${r.slug}`);
              return (
                <Link 
                  key={r.slug} 
                  href={`/${basePath}/${r.slug}`}
                  className={`text-[10px] font-bold tracking-widest px-3 py-1 transition-all ${isActive ? 'text-white border-b-2 border-purple-500' : 'text-zinc-600 hover:text-zinc-300'}`}
                >
                  {r.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. RED: ŽANROVI (SAMO NA REGION/TOP LISTAMA) */}
      {isRegionPage && (
        <div className="bg-black border-t border-white/5 py-3">
          <div className="flex flex-wrap justify-center gap-4 px-4">
            {genres.map((g) => (
              <Link 
                key={g.slug} 
                href={`${pathname.split('/').slice(0,3).join('/')}/${g.slug}`}
                className="text-[9px] font-bold border border-zinc-800 px-4 py-1 hover:border-purple-500 transition-all text-zinc-500 uppercase"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}