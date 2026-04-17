import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function FestivalDetailPage({ 
  params 
}: { 
  params: Promise<{ regionName: string, id: string }> 
}) {
  const { id, regionName } = await params;

  // 1. POVLAČENJE PODATAKA O FESTIVALU
  const { data: fest, error } = await supabase
    .from('festivals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !fest) {
    return <div className="pt-60 text-center uppercase font-black text-red-500">Festival Not Found</div>;
  }

  // 2. POVLAČENJE POVEZANIH VESTI (Tražimo vesti koje pominju ime festivala)
  const { data: relatedNews } = await supabase
    .from('news')
    .select('*')
    .ilike('title', `%${fest.name}%`)
    .limit(3);

  return (
    <div className="min-h-screen bg-white text-black pt-40 pb-20 font-sans uppercase font-black">
      <div className="max-w-[1400px] mx-auto px-6">
        
        {/* NAVIGACIJA */}
        <Link 
          href={`/festivals/${regionName}`} 
          className="text-[10px] tracking-[0.4em] hover:text-purple-600 mb-12 block transition-colors border-b-2 border-black w-fit pb-2"
        >
          ← BACK TO {regionName.toUpperCase()} CALENDAR
        </Link>

       {/* NASLOV SA PLAVOM POZADINOM - SMANJEN FONT */}
<div className="relative mb-16 mt-10">
  {/* Plavi boks u pozadini smo malo smanjili i pomerili */}
  <div className="absolute -top-6 -left-6 w-32 h-32 md:w-48 md:h-48 bg-blue-500 -z-10 opacity-90 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)]"></div>
  
  <h1 className="text-[12vw] md:text-[8vw] lg:text-[7rem] font-black leading-[0.8] tracking-tighter break-words max-w-4xl">
    {fest.name}
  </h1>
  
  {/* Dodajemo lokaciju odmah ispod naslova za bolji balans */}
  <div className="mt-4 inline-block bg-black text-white px-4 py-2 text-xs tracking-widest">
    {fest.location} // 2026
  </div>
</div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* LEVA KOLONA: VIDEO, OPIS, LINEUP, GALERIJA */}
          <div className="lg:col-span-8">
            
          {/* YOUTUBE AFTERMOVIE - SA PROVEROM */}
<div className="aspect-video bg-black mb-16 shadow-[20px_20px_0px_0px_rgba(147,51,234,1)] border-4 border-black overflow-hidden">
  <iframe 
    width="100%" 
    height="100%" 
    src={`https://www.youtube.com/embed/${fest.video_id}?rel=0&modestbranding=1`}
    title="Festival Video" 
    frameBorder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    referrerPolicy="strict-origin-when-cross-origin" // OVO REŠAVA "NOT AVAILABLE"
    allowFullScreen
    className="grayscale hover:grayscale-0 transition-all duration-700 w-full h-full"
  ></iframe>
</div>

            {/* OPIS */}
            <div className="mb-20">
              <p className="text-3xl md:text-5xl leading-[0.9] italic border-l-[15px] border-black pl-8 text-zinc-500 mb-12">
                "{fest.description}"
              </p>
            </div>

            {/* LINEUP */}
            <div className="mb-32">
              <h3 className="text-xs tracking-[0.5em] mb-12 text-purple-600">OFFICIAL 2026 LINEUP</h3>
              <div className="flex flex-wrap gap-x-12 gap-y-6 border-b-[1px] border-zinc-200 pb-20">
                {fest.lineup?.map((artist: string) => (
                  <span key={artist} className="text-4xl md:text-7xl tracking-tighter hover:italic transition-all">
                    {artist}
                  </span>
                ))}
              </div>
            </div>

           {/* --- AD SLOT 1 (HORIZONTAL) --- */}
<div className="w-full my-20">
  <p className="text-[10px] text-zinc-400 mb-2 tracking-[0.3em] font-bold">ADVERTISEMENT</p>
  <div className="w-full bg-zinc-50 border-2 border-dashed border-zinc-200 py-10 flex justify-center items-center">
    {/* Ovde ćeš kasnije nalepiti Google <ins> kod */}
    <span className="text-zinc-300 italic text-sm">Google AdSense Banner Area</span>
  </div>
</div>

          {/* DINAMIČKA GALERIJA - RADI I ZA JEDNU I ZA VIŠE SLIKA */}
<div className="mb-40">
  <h3 className="text-xs tracking-[0.5em] mb-8 text-zinc-400 italic">Visual Archive // Live Shots</h3>
  
{/* GALERIJA - VEĆE SLIKE I RAZNOLIKOST */}
{/* VELIKA GALERIJA - 2 KOLONE */}
{/* GALERIJA - 2 VELIKE KOLONE */}
{/* --- VELIKA GALERIJA: 2 KOLONE --- */}
{/* GALERIJA - VELIKE I UNIKATNE FOTOGRAFIJE */}
<div className="mb-40 px-6">
  {/* grid-cols-1 znači da će na mobilnom biti jedna ogromna, a md:grid-cols-2 dve velike jedna pored druge */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
    {fest.image_url && Array.isArray(fest.image_url) && fest.image_url.map((img: string, index: number) => (
      <div key={index} className="group">
        <div className="aspect-[16/9] border-[12px] border-black overflow-hidden bg-zinc-100 shadow-[25px_25px_0px_0px_rgba(0,0,0,1)] hover:shadow-[25px_25px_0px_0px_rgba(147,51,234,1)] transition-all duration-700">
          <img 
            src={img} 
            alt="fest visual" 
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110" 
          />
        </div>
        
        {/* INFO BAR ISPOD SVAKE SLIKE */}
        <div className="mt-8 flex justify-between items-end border-b-8 border-black pb-4">
          <div>
            <p className="text-[10px] font-bold text-purple-600 tracking-[0.5em] mb-1">VISUAL_ASSET</p>
            <h4 className="text-4xl font-black italic uppercase italic">SHOT_0{index + 1}</h4>
          </div>
          <span className="text-sm font-black tabular-nums bg-black text-white px-3 py-1">
            {fest.id}-2026
          </span>
        </div>
      </div>
    ))}
  </div>
</div>
</div>

            {/* RELATED NEWS SEKCIJA */}
            {relatedNews && relatedNews.length > 0 && (
              <div className="mt-32 border-t-[12px] border-black pt-16">
                <h2 className="text-6xl tracking-tighter mb-16 italic underline">LATEST UPDATES<span className="text-purple-600">.</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {relatedNews.map((news) => (
                    <Link key={news.id} href={`/news/${regionName}/${news.id}`} className="group">
                      <div className="aspect-video overflow-hidden mb-6 bg-zinc-100 border-b-4 border-black">
                        <img src={news.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100" />
                      </div>
                      <h4 className="text-lg leading-tight group-hover:text-purple-600">{news.title}</h4>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DESNA KOLONA: TICKETS & INFO */}
          <div className="lg:col-span-4">
            <div className="sticky top-40 space-y-12">
              
              {/* TICKETS BOX */}
              <div className="bg-black text-white p-10 shadow-[15px_15px_0px_0px_rgba(147,51,234,1)]">
                <span className="text-[10px] tracking-[0.5em] text-zinc-500 block mb-6 uppercase">Official Tickets Partner</span>
                
                <div className="mb-8">
                  <p className="text-[10px] text-zinc-400 mb-1 uppercase">Location</p>
                  <p className="text-xl">{fest.location}</p>
                </div>

                <div className="mb-12">
                  <p className="text-[10px] text-zinc-400 mb-1 uppercase">Event Date</p>
                  <p className="text-xl">
                    {new Date(fest.date_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <a 
                  href={fest.tickets_url} 
                  target="_blank" 
                  className="block w-full bg-purple-600 py-6 text-center text-sm font-black hover:bg-white hover:text-black transition-all border-2 border-transparent hover:border-black"
                >
                  BUY ON TICKETMASTER →
                </a>
              </div>

              {/* INFO BOX */}
              <div className="border-[6px] border-black p-8 italic">
                <p className="text-[10px] tracking-[0.3em] mb-4 not-italic">ADVERTISEMENT</p>
                <p className="text-sm leading-relaxed">
  GET EXCLUSIVE ACCESS TO VIP PACKAGES AND BACKSTAGE PASSES FOR {fest.name.toUpperCase()}.
</p>npm
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}