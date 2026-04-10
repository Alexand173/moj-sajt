import { createClient } from '@supabase/supabase-js';
import Link from 'next/link'; // OBAVEZNO ZA LINKOVE

// Inicijalizacija klijenta
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

  // Vučemo vesti iz baze
  const { data: news, error } = await supabase
    .from('news')
    .select('*')
    .or(`region.eq.${region},region.eq.world`)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) return <div className="pt-60 text-center text-red-500 uppercase font-black">Error: {error.message}</div>;
  if (!news || news.length === 0) return <div className="pt-60 text-center uppercase font-black">No news found for {region}</div>;

  const featuredNews = news[0];
  const otherNews = news.slice(1);

  return (
    <div className="min-h-screen bg-white text-black pt-52 pb-40">
      <div className="max-w-[1400px] mx-auto px-6">
        
        {/* ZAGLAVLJE */}
        <div className="border-b-[12px] border-black mb-16 pb-6 flex flex-col md:flex-row justify-between items-baseline gap-4">
          <h1 className="text-[12vw] md:text-9xl font-black uppercase tracking-tighter leading-none">
            {region}<span className="text-purple-600 italic">.</span>News
          </h1>
          <div className="flex flex-col items-end uppercase font-black">
            <span className="text-xs tracking-[0.3em] text-zinc-400">Music Industry Daily</span>
            <span className="text-sm text-black">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* LEVA KOLONA: GLAVNA VEST */}
          <div className="lg:col-span-8">
            {/* LINK OKO CELE GLAVNE VESTI */}
            <Link href={`/news/${region}/${featuredNews.id}`} className="group block mb-20 border-b border-zinc-100 pb-20">
              <div className="relative aspect-[16/9] mb-8 overflow-hidden bg-zinc-100">
                <img 
                  src={featuredNews.image} 
                  alt={featuredNews.title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-105"
                />
              </div>
              <span className="text-purple-600 font-black text-xs tracking-[0.3em] uppercase block mb-4">{featuredNews.category}</span>
              <h2 className="text-5xl md:text-7xl font-serif font-black leading-[0.9] tracking-tight group-hover:text-purple-600 transition-colors uppercase">
                {featuredNews.title}
              </h2>
              <p className="mt-8 text-xl md:text-2xl text-zinc-600 leading-relaxed font-medium uppercase line-clamp-3">
                {featuredNews.excerpt}
              </p>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-[2px] w-12 bg-black"></div>
                <span className="text-xs font-black uppercase tracking-widest group-hover:text-purple-600">Read Full Story</span>
              </div>
            </Link>

            {/* LISTA OSTALIH VESTI */}
            <div className="space-y-24">
              {otherNews.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-10 gap-8 group border-t border-zinc-100 pt-12">
                  <Link href={`/news/${region}/${item.id}`} className="md:col-span-4 aspect-video md:aspect-square overflow-hidden bg-zinc-100">
                    <img 
                      src={item.image} 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all group-hover:scale-110 duration-500" 
                      alt={item.title} 
                    />
                  </Link>
                  <div className="md:col-span-6 flex flex-col justify-center">
                    <span className="text-purple-600 font-black text-[10px] tracking-[0.3em] uppercase mb-3">{item.category}</span>
                    <Link href={`/news/${region}/${item.id}`}>
                      <h3 className="text-3xl font-bold leading-tight tracking-tighter uppercase group-hover:text-purple-600 transition-colors">
                        {item.title}
                      </h3>
                    </Link>
                    <p className="text-zinc-500 mt-4 text-sm font-medium line-clamp-3 uppercase leading-relaxed">{item.excerpt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DESNA KOLONA: SIDEBAR */}
          <div className="lg:col-span-4">
            <div className="sticky top-44 border-l-2 border-zinc-100 pl-10">
              <h4 className="font-black text-xs uppercase tracking-[0.4em] mb-12 text-zinc-400 flex items-center gap-4">
                <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                Trending News
              </h4>
              <div className="space-y-16">
                {news.slice(0, 6).map((item, index) => (
                  <Link key={item.id} href={`/news/${region}/${item.id}`} className="group block relative pl-12">
                    <span className="absolute left-0 top-0 text-5xl font-black text-zinc-100 group-hover:text-purple-100 transition-colors italic -z-10 leading-none">
                      0{index + 1}
                    </span>
                    <h5 className="font-black text-sm tracking-tight leading-tight uppercase group-hover:text-purple-600 italic">
                      {item.title}
                    </h5>
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}