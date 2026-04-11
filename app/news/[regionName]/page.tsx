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
  const { regionName } = await params;
  const region = regionName.toLowerCase();

  // 1. DOHVATANJE VESTI - Filtriramo po tvom 'category' polju iz baze
  
  // Vesti sa sajtova zvezda (Official Scraper)
  const { data: officialNews } = await supabase
    .from('news')
    .select('*')
    .eq('category', 'OFFICIAL') 
    .order('created_at', { ascending: false })
    .limit(10);

  // Glavne vesti za centralni deo (News API / LATEST)
  const { data: latestNews } = await supabase
    .from('news')
    .select('*')
    .eq('region', region)
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
          <h1 className="text-[10vw] leading-[0.8] tracking-tighter">
            {region}<span className="text-purple-600">.</span>FEED
          </h1>
          <span className="text-xl pb-2">EST. 2026</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* --- LEVA KOLONA: OFFICIAL ARTIST FEED (Horizontalni kontejner) --- */}
          <aside className="lg:col-span-3 border-r-4 border-black pr-8">
            <h2 className="text-2xl bg-black text-white px-3 py-1 inline-block mb-10 tracking-widest">
              OFFICIAL SOURCE
            </h2>
            <div className="flex flex-col gap-10">
              {officialNews?.map((item) => (
                <div key={item.id} className="border-b border-zinc-200 pb-6 group cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-ping"></div>
                    <span className="text-[10px] text-purple-600">DIRECT UPDATE</span>
                  </div>
                  <h3 className="text-lg leading-tight group-hover:text-purple-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-2 font-medium normal-case italic leading-relaxed">
                    {item.excerpt.substring(0, 80)}...
                  </p>
                </div>
              ))}
            </div>
          </aside>

          {/* --- CENTRALNI DEO: MAIN NEWS (Smanjen font i slike) --- */}
          <main className="lg:col-span-6">
            {/* Glavna vest */}
            <Link href={`/news/${region}/${featuredNews.id}`} className="group block mb-20 border-b-[6px] border-black pb-12">
              <div className="aspect-video mb-8 overflow-hidden border-4 border-black shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <img 
                  src={featuredNews.image} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" 
                  alt={featuredNews.title} 
                />
              </div>
              <h2 className="text-4xl md:text-5xl leading-[0.9] tracking-tighter group-hover:text-purple-600 transition-colors">
                {featuredNews.title}
              </h2>
              <p className="mt-6 text-sm text-zinc-600 font-medium normal-case leading-relaxed">
                {featuredNews.excerpt}
              </p>
            </Link>

            {/* Grid ostalih vesti - Kompaktnije */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
              {otherNews.map((item) => (
                <Link key={item.id} href={`/news/${region}/${item.id}`} className="group block">
                  <div className="aspect-video overflow-hidden border-2 border-black mb-4 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <img 
                      src={item.image} 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" 
                      alt="" 
                    />
                  </div>
                  <h3 className="text-lg leading-tight group-hover:text-purple-600 transition-colors">
                    {item.title}
                  </h3>
                </Link>
              ))}
            </div>
          </main>

          {/* --- DESNA KOLONA: TRENDING (Tvoj originalni sidebar) --- */}
          <aside className="lg:col-span-3">
            <div className="sticky top-40 border-l-4 border-black pl-8">
              <h2 className="text-2xl mb-12 tracking-tighter underline decoration-purple-600 decoration-4">
                TRENDING NOW
              </h2>
              <div className="space-y-14">
                {latestNews.slice(0, 5).map((item, index) => (
                  <Link key={item.id} href={`/news/${region}/${item.id}`} className="group block relative pl-12">
                    <span className="absolute left-0 top-0 text-5xl font-black text-zinc-100 group-hover:text-purple-100 transition-colors italic -z-10 leading-none">
                      0{index + 1}
                    </span>
                    <h5 className="text-sm tracking-tight leading-tight group-hover:text-purple-600 transition-all">
                      {item.title}
                    </h5>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}