'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  // 1. PRECIZNIJE PROVERE (Dodajemo provere koje pokrivaju sve podstranice)
  const isHome = pathname === '/';
  const isNewsPage = pathname.startsWith('/news');
  const isReviewsPage = pathname.startsWith('/reviews'); 
  const isToursPage = pathname.startsWith('/tours');
  const isFestivalsPage = pathname.startsWith('/festivals');
  const isAwardsPage = pathname === '/awards';

  const pages = [
    { name: 'NEWS', href: '/news/us' },
    { name: 'TOURS', href: '/tours/us' },
    { name: 'FESTIVALS', href: '/festivals/us' },
    { name: 'REVIEWS', href: '/reviews/us' },
  ];

  const regions = ['US', 'UK', 'LATINO', 'ASIA', 'EUROPA', 'WORLD', 'JAZZ', 'CLASSICAL'];

  const genres = [
    { name: 'ROCK', slug: 'rock' },
    { name: 'POP', slug: 'pop' },
    { name: 'HIPHOP/RAP', slug: 'hip-hop' },
    { name: 'R&B / SOUL', slug: 'rb-soul' },
    { name: 'COUNTRY', slug: 'country' },
    { name: 'DANCE / ELECTRONIC', slug: 'electronic' },
  ];

  const getCurrentRegion = () => {
    const parts = pathname.split('/');
    if (parts.includes('region')) return parts[parts.indexOf('region') + 1];
    if (parts.includes('news')) return parts[parts.indexOf('news') + 1];
    if (parts.includes('tours')) return parts[parts.indexOf('tours') + 1];
    if (parts.includes('reviews')) return parts[parts.indexOf('reviews') + 1];
    return 'world';
  };

  const currentRegion = getCurrentRegion();

  return (
    <header className="fixed top-0 left-0 w-full z-[100] bg-black border-b border-white/10">
      
      {/* 1. RED: LOGO I GLAVNA NAVIGACIJA */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-6">
        
        <Link href="/" className={`text-3xl font-black italic tracking-tighter transition-all duration-500 ${isHome ? 'text-white drop-shadow-[0_0_15px_rgba(147,51,234,1)]' : 'text-zinc-700 hover:text-zinc-400'}`}>
          MUSIC<span className={isHome ? "text-purple-400" : "text-zinc-800"}>TOP</span>
        </Link>

        <nav className="flex items-center gap-6 md:gap-10 flex-wrap justify-center">
          {pages.map((p) => {
            const baseRoute = p.href.split('/')[1]; 
            const isActive = pathname.startsWith(`/${baseRoute}`);

            return (
              <Link key={p.name} href={p.href}
                className={`text-[12px] font-black tracking-[0.2em] transition-all duration-300 relative py-2 ${
                  isActive ? 'text-purple-600 drop-shadow-[0_0_10px_rgba(147,51,234,0.8)]' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {p.name}
                {isActive && <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.8)]" />}
              </Link>
            );
          })}
          
          <Link href="/awards" className={`px-6 py-2 rounded-full border-2 text-[10px] font-black transition-all ${isAwardsPage ? 'bg-yellow-600 text-black border-yellow-600 shadow-[0_0_25px_rgba(202,138,4,0.6)]' : 'border-yellow-600/30 text-yellow-600 hover:bg-yellow-600 hover:text-black'}`}>
            MTA 🏆
          </Link>
        </nav>
      </div>

      {/* 2. RED: REGIONI - SAKRIJ AKO JE REVIEWS */}
      {!isReviewsPage && (
        <div className="bg-zinc-900/30 border-t border-white/5">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 py-3 px-6">
            {regions.map((r) => {
              const lowerR = r.toLowerCase();
              let targetHref = `/region/${lowerR}/rock`;
              if (isNewsPage) targetHref = `/news/${lowerR}`;
              else if (isToursPage) targetHref = `/tours/${lowerR}`;
              else if (isFestivalsPage) targetHref = `/festivals/${lowerR}`;

              const isActive = pathname.includes(`/${lowerR}`);

              return (
                <Link key={r} href={targetHref} className={`text-[11px] font-black tracking-[0.2em] transition-all ${isActive ? 'text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'text-zinc-600'}`}>
                  {r}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. RED: ŽANROVI - SAKRIJ AKO JE NEWS ILI REVIEWS */}
      {(!isNewsPage && !isReviewsPage) && (
        <div className="bg-black border-t border-white/5">
          <div className="flex flex-wrap justify-center gap-2 md:gap-6 py-3 px-4">
            {genres.map((g) => {
              const isActive = pathname.includes(`/${g.slug}`);
              const targetHref = currentRegion === 'world' ? `/genre/${g.slug}` : `/region/${currentRegion}/${g.slug}`;
              return (
                <Link key={g.slug} href={targetHref} className={`text-[9px] md:text-[10px] font-bold tracking-[0.1em] px-4 py-1.5 rounded-md border transition-all ${isActive ? 'text-white bg-purple-600 border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'text-zinc-600 border-transparent hover:text-zinc-300'}`}>
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