import { createClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
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
  // 1. ISKLJUČUJEMO KEŠIRANJE (Nuklearna opcija za sveže podatke)
  noStore();

  const { regionName } = await params;
  const region = regionName.toLowerCase();

  // 2. PARALELNO DOHVATANJE (Brže učitavanje)
  const [officialRes, latestRes] = await Promise.all([
    supabase
      .from('news')
      .select('*')
      .eq('region', region)
      .eq('category', 'OFFICIAL')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('news')
      .select('*')
      .eq('region', region)
      .eq('category', 'LATEST')
      .order('created_at', { ascending: false })
      .limit(12)
  ]);

  // Provera grešaka
  if (latestRes.error) console.error("Error fetching Latest:", latestRes.error);
  if (officialRes.error) console.error("Error fetching Official:", officialRes.error);

  const officialNews = officialRes.data || [];
  const latestNews = latestRes.data || [];

  // Ako nema vesti, prikaži 404 ili poruku
  if (latestNews.length === 0) {
    return <div className="pt-40 text-center font-black uppercase text-2xl">No news found for {region}...</div>;
  }

  const featuredNews = latestNews[0];
  const otherNews = latestNews.slice(1);

  const communityPosts = [
    { id: 1, user: "@ROCKER_88", text: "IMA LI NEKO SETLISTU OD SINOĆ?", time: "2 MIN AGO" },
    { id: 2, user: "@VINYL_LOVER", text: "PRODAJEM DVE KARTE ZA BERLIN.", time: "15 MIN AGO" },
    { id: 3, user: "@STEFAN_K", text: "NOVI ALBUM JE POKIDAO!", time: "1 H AGO" },
  ];

  return (
    <div className="min-h-screen bg-white text-black pt-2 pb-5 font-sans uppercase font-black">
      <div className="max-w-[1700px] mx-auto px-6">
        
        {/* NASLOV */}
        <div className="border-b-[4px] border-black mt-4 mb-6 pb-2 flex justify-between items-end">
          <h1 className="text-5xl font-bold leading-none tracking-tighter uppercase">
            {region}<span className="text-purple-600">.</span>FEED
          </h1>
          <span className="text-sm font-bold pb-1 uppercase tracking-widest text-gray-400">EST. 2026</span>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-12">
          
          {/* --- LEVA KOLONA: OFFICIAL --- */}
          <aside className="order-3 lg:order-none lg:col-span-3 border-t-4 lg:border-t-0 lg:border-r-4 border-black pt-10 lg:pt-0 lg:pr-8 mt-10 lg:mt-0">
            <h2 className="text-2xl bg-black text-white px-3 py-1 inline-block mb-10 tracking-widest uppercase">
              OFFICIAL {region}
            </h2>
            <div className="flex flex-col gap-6">
              {officialNews.map((news) => (
                <a key={news.id} href={news.url} target="_blank" rel="noopener noreferrer" className="block group border-b border-black/5 pb-4 hover:opacity-70 transition">
                  <span className="text-purple-600 font-bold text-[10px] tracking-widest mb-1 uppercase">LIVE FEED</span>
                  <h3 className="font-black text-sm leading-tight uppercase line-clamp-2 group-hover:underline">{news.title}</h3>
                  <p className="italic text-gray-400 text-[10px] mt-1 normal-case font-medium">{news.excerpt}</p>
                </a>
              ))}
            </div>
          </aside>

          {/* --- CENTRALNI DEO: LATEST --- */}
          <main className="order-1 lg:order-none lg:col-span-6">
            <Link href={`/news/${region}/${featuredNews.id}`} className="group block mb-20 border-b-[6px] border-black pb-12">
              <div className="aspect-video mb-8 overflow-hidden border-4 border-black shadow-[12px_12px_0px_0px_rgba(147,51,234,1)]">
                <img src={featuredNews.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={featuredNews.title} />
              </div>
              <h2 className="text-4xl md:text-5xl leading-[0.9] tracking-tighter group-hover:text-purple-600 transition-colors uppercase">{featuredNews.title}</h2>
              <p className="mt-6 text-sm text-zinc-600 font-medium normal-case leading-relaxed">{featuredNews.excerpt}</p>
            </Link>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
              {otherNews.map((item) => (
                <Link key={item.id} href={`/news/${region}/${item.id}`} className="group block">
                  <div className="aspect-video overflow-hidden border-2 border-black mb-4 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                  </div>
                  <h3 className="text-lg leading-tight group-hover:text-purple-600 transition-colors uppercase">{item.title}</h3>
                </Link>
              ))}
            </div>
          </main>

       {/* --- DESNA KOLONA: TRENDING --- */}
<aside className="order-2 lg:order-none lg:col-span-3">
  {/* Uklonjen sticky i top-40 */}
  <div className="border-l-4 border-black pl-8">
    {/* Sadržaj će se sada normalno produžavati nadole */}
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

    {/* --- AD SLOT 2: DESNO --- */}
    <div className="mt-20 w-full h-[300px] border-4 border-black bg-zinc-50 flex flex-col items-center justify-center p-4 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.05)]">
      <span className="text-[9px] text-zinc-400 font-black mb-4 vertical-text rotate-180 uppercase tracking-widest">Advertisement</span>
      <div className="italic text-zinc-200 text-xs">AD_SLOT_02</div>
    </div>

   {/* --- COMMUNITY CHAT SEKCIJA --- */}
<div className="mt-16 border-t-4 border-black pt-6">
  <h2 className="text-xl font-black mb-6 tracking-tighter italic uppercase">
    COMMUNITY<span className="text-purple-600">.</span>CHAT
  </h2>
  
  <div className="space-y-6">
    {/* Mapiramo postove iz niza communityPosts */}
    {communityPosts.map((post) => (
      <div key={post.id} className="group cursor-pointer border-b border-zinc-100 pb-4">
        <p className="text-[13px] font-black leading-tight group-hover:text-purple-600 transition-colors uppercase">
          "{post.text}"
        </p>
        <div className="flex justify-between mt-2 text-[9px] font-bold text-zinc-400 uppercase">
          <span>{post.user}</span>
          <span>{post.time}</span>
        </div>
      </div>
    ))}

    {/* Dugme za akciju */}
    <button className="w-full border-4 border-black py-3 text-xs font-black hover:bg-black hover:text-white transition-all uppercase shadow-[4px_4px_0px_0px_rgba(147,51,234,0.3)]">
      Post to Chat
    </button>
  </div>
</div>

  </div>
</aside>

        </div> {/* Kraj Grid/Flex containera */}
      </div>
    </div>
  );
}