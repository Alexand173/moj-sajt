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

  // U produkciji, koristi util koji koristi anon key + RLS
// 1. Fetch festivala
const { data: fest } = await supabase
  .from('festivals')
  .select('*')
  .eq('id', id)
  .single();

// 2. Fetch vesti koje sadrže ime festivala
const { data: relatedNews } = await supabase
  .from('news')
  .select('*')
  .ilike('title', `%${fest.name}%`) // Ovo traži vesti čiji naslov sadrži ime festivala
  .limit(3);

// 3. Prikaz u JSX-u (dodaj ovo ispod galerije u svom kodu):
{relatedNews && relatedNews.length > 0 && (
  <div className="mt-20">
    <h3 className="text-xs tracking-[0.5em] mb-8 text-purple-600">RELATED NEWS</h3>
    {relatedNews.map((news) => (
      <div key={news.id} className="border-t border-black py-6">
        <h4 className="text-xl font-bold">{news.title}</h4>
      </div>
    ))}
  </div>
)}

  return (
    
    
    
    
    <div className="min-h-screen bg-white text-black pt-40 pb-20 font-sans uppercase font-black">
      <div className="max-w-[1400px] mx-auto px-6">
        
        <Link 
          href={`/festivals/${regionName}`} 
          className="text-[10px] tracking-[0.4em] hover:text-purple-600 mb-12 block transition-colors border-b-2 border-black w-fit pb-2"
        >
          ← BACK TO {regionName.toUpperCase()} CALENDAR
        </Link>

        <div className="relative mb-16 mt-10">
          <div className="absolute -top-6 -left-6 w-32 h-32 md:w-48 md:h-48 bg-blue-500 -z-10 opacity-90 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)]"></div>
          <h1 className="text-[12vw] md:text-[8vw] lg:text-[7rem] font-black leading-[0.8] tracking-tighter break-words max-w-4xl">
            {fest.name}
          </h1>
          <div className="mt-4 inline-block bg-black text-white px-4 py-2 text-xs tracking-widest">
            {fest.location} // 2026
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            
            {/* Video sekcija - dodata provera da li video_id postoji */}
            {fest.video_id && (
              <div className="aspect-video bg-black mb-16 shadow-[20px_20px_0px_0px_rgba(147,51,234,1)] border-4 border-black overflow-hidden">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${fest.video_id}?rel=0&modestbranding=1`}
                  title="Festival Video" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="grayscale hover:grayscale-0 transition-all duration-700 w-full h-full"
                ></iframe>
              </div>
            )}

            <div className="mb-20">
              <p className="text-3xl md:text-5xl leading-[0.9] italic border-l-[15px] border-black pl-8 text-zinc-500 mb-12">
                "{fest.description}"
              </p>
            </div>

            {/* Lineup sekcija */}
            <div className="mb-32">
              <h3 className="text-xs tracking-[0.5em] mb-12 text-purple-600">OFFICIAL 2026 LINEUP</h3>
              <div className="flex flex-wrap gap-x-12 gap-y-6 border-b-[1px] border-zinc-200 pb-20">
                {fest.lineup?.map((artist: string, idx: number) => (
                  <span key={idx} className="text-4xl md:text-7xl tracking-tighter hover:italic transition-all">
                    {artist}
                  </span>
                ))}
              </div>
            </div>

            {/* Galerija */}
            <div className="mb-40 px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {Array.isArray(fest.image_url) && fest.image_url.map((img: string, index: number) => (
                  <div key={index} className="group">
                    <div className="aspect-[16/9] border-[12px] border-black overflow-hidden bg-zinc-100 shadow-[25px_25px_0px_0px_rgba(0,0,0,1)] hover:shadow-[25px_25px_0px_0px_rgba(147,51,234,1)] transition-all duration-700">
                      <img src={img} alt="fest visual" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Desna strana */}
          <div className="lg:col-span-4">
            <div className="sticky top-40 space-y-12">
              <div className="bg-black text-white p-10 shadow-[15px_15px_0px_0px_rgba(147,51,234,1)]">
                <span className="text-[10px] tracking-[0.5em] text-zinc-500 block mb-6 uppercase">Official Tickets Partner</span>
                <a 
                  href={fest.tickets_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block w-full bg-purple-600 py-6 text-center text-sm font-black hover:bg-white hover:text-black transition-all border-2 border-transparent hover:border-black"
                >
                  BUY ON TICKETMASTER →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}