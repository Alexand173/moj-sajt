import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Metadata } from 'next';


export const revalidate = 3600; // Podaci će se osvežavati na svakih sat vremena
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
export async function generateMetadata({ params }: { params: Promise<{ regionName: string }> }): Promise<Metadata> {
  const { regionName } = await params;
  return {
    title: `Best Music Festivals in ${regionName.toUpperCase()} - 2026 Guide`,
    description: `Discover upcoming music festivals in ${regionName} for 2026. Get tickets and info.`
  };
}

interface Festival {
  id: string;
  name: string;
  date_start: Date;
  location: string;
  image_url: string


  // dodaj ostala polja koja imaš u tabeli
}
export default async function RegionalFestivalsPage({ 
  params 
}: { 
  params: Promise<{ regionName: string }> 
}) {
  const { regionName } = await params;
  const region = regionName.toLowerCase();

 const { data: festivals, error } = await supabase
  .from('festivals')
  .select('*')
  .eq('region', region)
  .order('date_start', { ascending: true }) as { data: Festival[] | null, error: any };

  if (error) return <div className="pt-60 text-center uppercase font-black text-red-500">Error loading festivals</div>;

  return (
    // GLAVNI KONTEJNER SA POZADINOM
    <div 
      className="min-h-screen font-sans"
      style={{ 
        backgroundImage: "url('/images/fest.png')", 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed' 
      }}
    >
      {/* OVERLAY - OVO ČINI TEKST ČITLJIVIM PREKO SLIKE */}
      <div className="bg-white/80 min-h-screen pt-5 pb-10">
        <div className="max-w-[1400px] mx-auto px-6">
          
          {/* GLAVNI NASLOV */}
          <div className="border-b-[15px] border-black mb-20 pb-3 flex flex-col md:flex-row justify-between items-baseline">
            <h1 className="text-[8vw] md:text-[10rem] font-black uppercase tracking-tighter leading-[0.7]">
              {region}<span className="text-purple-600">.</span>Fest
            </h1>
            <div className="flex flex-col items-end">
               <span className="font-black uppercase text-xs tracking-[0.3em] text-zinc-400">
                 2026 Global Guide
               </span>
               <span className="text-[10px] font-bold text-purple-600 mt-2">
                 TOTAL: {festivals?.length || 0} EVENTS FOUND
               </span>
            </div>
          </div>

          {/* LISTA FESTIVALA */}
          <div className="divide-y-[2px] divide-black">
            {festivals && festivals.length > 0 ? (
              festivals.map((fest) => (
                <Link 
                  key={fest.id} 
                  href={`/festivals/${region}/${fest.id}`} 
                  className="group grid grid-cols-1 md:grid-cols-12 py-12 md:py-16 items-center hover:bg-zinc-50/50 transition-all px-4"
                >
                  <div className="md:col-span-2">
                    <span className="text-3xl font-black uppercase tracking-tighter group-hover:text-purple-600 transition-colors">
                      {new Date(fest.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="md:col-span-7">
                    <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-4 group-hover:italic transition-all">
                      {fest.name}
                    </h2>
                    <div className="inline-block bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest group-hover:bg-purple-600">
                      {fest.location}
                    </div>
                  </div>

                  <div className="md:col-span-3 flex md:justify-end mt-8 md:mt-0">
                    <div className="border-4 border-black px-10 py-5 text-xs font-black uppercase tracking-[0.2em] group-hover:bg-black group-hover:text-white transition-all shadow-[10px_10px_0px_0px_rgba(0,0,0,0.1)] group-hover:shadow-[10px_10px_0px_0px_rgba(147,51,234,1)]">
                      Details & Tickets
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-40 text-center">
                <h3 className="text-5xl font-black uppercase text-zinc-400 italic tracking-tighter">No Festivals Found</h3>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}