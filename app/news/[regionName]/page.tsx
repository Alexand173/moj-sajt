import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function BillboardNewsPage({ 
  params 
}: { 
  params: Promise<{ regionName: string }> 
}) {
  // 1. Next.js 15 params rukovanje
  const resolvedParams = await params;
  const region = resolvedParams.regionName.toUpperCase();

  // 2. DOHVATANJE PODATAKA
  // Zvanični izvori (Leva kolona na desktopu, dno na mobilnom)
  const { data: officialNews } = await supabase
    .from('news')
    .select('*')
    .eq('category', 'OFFICIAL')
    .eq('region', region)
    .order('created_at', { ascending: false })
    .limit(20);

  // Glavne vesti (Sredina na desktopu, vrh na mobilnom)
  const { data: latestNews } = await supabase
    .from('news')
    .select('*')
    .eq('region', region.toLowerCase())
    .eq('category', 'LATEST')
    .order('created_at', { ascending: false })
    .limit(12);

  if (!latestNews || latestNews.length === 0) return notFound();

  const featuredNews = latestNews[0];
  const otherNews = latestNews.slice(1);

  return (
    <div className="min-h-screen bg-white text-black pt-52 pb-40 font-sans uppercase font-black">
      <div className="max-w-[1700px] mx-auto px-6">
        
        {/* NASLOV STRANICE */}
        <div className="border-b-[12px] border-black mb-16 pb-4 flex justify-between items-end">
          <h1 className="text-[7vw] leading-[0.8] tracking-tighter">
            {region}<span className="text-purple-600">.</span>FEED
          </h1>
          <span className="text-xl pb-2">EST. 2026</span>
        </div>

        {/* GLAVNI CONTENT LAYOUT */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12">
          
          {/* --- LEVA KOLONA: OFFICIAL SOURCE FEED --- */}
          {/* Na mobilnom ide na dno (order-3), na desktopu je prva (lg:order-none) */}
          <aside className="order-3 lg:order-none lg:col-span-3 border-t-4 lg:border-t-0 lg:border-r-4 border-black pt-10 lg:pt-0 lg:pr-8 mt-10 lg:mt-0">
            <h2 className="text-2xl bg-black text-white px-3 py-1 inline-block mb-10 tracking-widest uppercase">
              OFFICIAL {region}
            </h2>
            
            <div className="flex flex-col gap-6">
              {officialNews && officialNews.length > 0 ? (
                officialNews.map((news) => (
                  <a 
                    key={news.id} 
                    href={news.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block group border-b border-black/5 pb-4 hover:opacity-70 transition"
                  >
                    <div className="flex flex-col">
                      <span className="text-purple-600 font-bold text-[10px] tracking-widest mb-1 uppercase">
                        LIVE FEED
                      </span>
                      <h3 className="font-black text-sm md:text-base leading-tight uppercase line-clamp-2 group-hover:underline">
                        {news.title}
                      </h3>
                      <p className="italic text-gray-400 text-[10px] mt-1 normal-case font-medium">
                        {news.excerpt}
                      </p>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-gray-400 text-xs italic">No official updates...</p>
              )}
            </div>
          </aside>

          {/* --- CENTRALNI DEO: MAIN NEWS --- */}
          {/* Na mobilnom ide na vrh (order-1) */}
          <main className="order-1 lg:order-none lg:col-span-6">
            <Link href={`/news/${region.toLowerCase()}/${featuredNews.id}`} className="group block mb-20 border-b-[6px] border-black pb-12">
              <div className="aspect-video mb-8 overflow-hidden border-4 border-black shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <img 
                  src={featuredNews.image} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" 
                  alt={featuredNews.title} 
                />
              </div>
              <h2 className="text-4xl md:text-5xl leading-[0.9] tracking-tighter group-hover:text-purple-600 transition-colors uppercase">
                {featuredNews.title}
              </h2>
              <p className="mt-6 text-sm text-zinc-600 font-medium normal-case leading-relaxed">
                {featuredNews.excerpt}
              </p>
            </Link>
                {/* --- AD SLOT 1: SREDINA (Ispod glavne vesti) --- */}
            <div className="w-full h-32 bg-zinc-50 border-2 border-dashed border-zinc-200 mb-12 flex flex-col items-center justify-center overflow-hidden">
               <span className="text-[9px] text-zinc-300 tracking-[0.5em] mb-2 font-bold">SPONSORED_CONTENT</span>
               {/* OVDE IDE TVOJ AD SENSE KOD */}
               <div className="italic text-zinc-200 text-xs">AD_SLOT_01_728x90</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
              {otherNews.map((item) => (
                <Link key={item.id} href={`/news/${region.toLowerCase()}/${item.id}`} className="group block">
                  <div className="aspect-video overflow-hidden border-2 border-black mb-4 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                  </div>
                  <h3 className="text-lg leading-tight group-hover:text-purple-600 transition-colors uppercase">
                    {item.title}
                  </h3>
                </Link>
              ))}
            </div>
          </main>

          {/* --- DESNA KOLONA: TRENDING --- */}
          {/* Na mobilnom ide u sredinu (order-2) */}
          <aside className="order-2 lg:order-none lg:col-span-3">
            <div className="sticky top-40 border-l-4 border-black pl-8">
              <h2 className="text-2xl mb-12 tracking-tighter underline decoration-purple-600 decoration-4 uppercase">
                TRENDING NOW
              </h2>
              <div className="space-y-14">
                {latestNews.slice(0, 5).map((item, index) => (
                  <Link key={item.id} href={`/news/${region.toLowerCase()}/${item.id}`} className="group block relative pl-12">
                    <span className="absolute left-0 top-0 text-5xl font-black text-zinc-100 group-hover:text-purple-100 transition-colors italic -z-10 leading-none">
                      0{index + 1}
                    </span>
                    <h5 className="text-sm tracking-tight leading-tight group-hover:text-purple-600 transition-all uppercase">
                      {item.title}
                    </h5>
                  </Link>
                ))}
              </div>
                {/* --- AD SLOT 2: DESNO (Ispod Trendinga) --- */}
              <div className="mt-20 w-full h-[400px] border-4 border-black bg-zinc-50 flex flex-col items-center justify-center p-4 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.05)]">
                 <span className="text-[9px] text-zinc-400 font-black mb-4 vertical-text rotate-180 uppercase tracking-widest">Advertisement</span>
                 <div className="italic text-zinc-200 text-xs">AD_SLOT_02_VERTICAL</div>
              </div>



            </div>
          </aside>

        </div> {/* Kraj Grid/Flex containera */}
      </div>
    </div>
  );
}