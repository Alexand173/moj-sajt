import { Metadata } from 'next';
import { getPublicSupabaseClient } from '@/lib/supabase-public';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ regionName: string }> }): Promise<Metadata> {
  const { regionName } = await params;
  const region = regionName.toLowerCase();
  const canonical = `/festivals/${encodeURIComponent(region)}`;

  return {
    title: `Best Music Festivals in ${region.toUpperCase()} - 2026 Guide`,
    description: `Discover upcoming music festivals in ${region} for 2026. Get tickets and info.`,
    alternates: { canonical },
    openGraph: {
      title: `Best Music Festivals in ${region.toUpperCase()} - 2026 Guide`,
      description: `Discover upcoming music festivals in ${region} for 2026. Get tickets and info.`,
      url: canonical,
      type: 'website',
    },
  };
}

interface Festival {
  id: string;
  name: string;
  date_start: Date;
  location: string;
  image_url: string;
  tickets_url: string;
}

export default async function RegionalFestivalsPage({ 
  params 
}: { 
  params: Promise<{ regionName: string }> 
}) {
  const { regionName } = await params;
  const region = regionName.toLowerCase();
  const today = new Date().toISOString();

  const supabase = getPublicSupabaseClient();
  let festivals: Festival[] | null = null;
  let hasDatabaseError = false;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('region', region)
        .gte('date_start', today)
        .order('date_start', { ascending: true });
      festivals = (data || []) as Festival[];
      hasDatabaseError = Boolean(error);
    } catch (error) {
      console.warn(`Could not load ${region} festivals:`, error);
      hasDatabaseError = true;
    }
  }

  if (hasDatabaseError) return <div className="pt-60 text-center uppercase font-black text-red-500">Festival guide is temporarily unavailable</div>;

  return (
    <div 
      className="min-h-screen font-sans"
      style={{ 
        backgroundImage: "url('/images/fest.png')", 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed' 
      }}
    >
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
              festivals.map((fest) => {
                const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(fest.tickets_url)}&screenshot=true&embed=screenshot.url`;

                return (
                  <div 
                    key={fest.id} 
                    className="group grid grid-cols-1 md:grid-cols-12 py-12 md:py-16 items-center hover:bg-zinc-50/50 transition-all px-4 gap-y-6 md:gap-y-0"
                  >
                    {/* KOLONA 1: Datum — informational text, not a link */}
                    <div className="md:col-span-2">
                      <span className="text-3xl font-black uppercase tracking-tighter">
                        {new Date(fest.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* KOLONA 2: Naslov i Lokacija */}
                    <div className="md:col-span-5 pr-4">
                      <a
                        href={fest.tickets_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-4 group-hover:italic transition-all break-words">
                          {fest.name}
                        </h2>
                        <div className="inline-block bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest group-hover:bg-purple-600">
                          {fest.location}
                        </div>
                      </a>
                    </div>

                    {/* KOLONA 3: Kartica sa živim screenshotom */}
                    <div className="md:col-span-2 flex justify-start md:justify-center z-10">
                      <a 
                        href={fest.tickets_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-44 h-24 overflow-hidden border-4 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,0.15)] hover:shadow-[5px_5px_0px_0px_rgba(147,51,234,1)] hover:scale-105 transition-all shrink-0 block bg-zinc-200"
                      >
                        <img 
                          src={screenshotUrl} 
                          alt={`Home page preview of ${fest.name}`} 
                          className="w-full h-full object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-300"
                        />
                      </a>
                    </div>

                  </div>
                );
              })
            ) : (
              <div className="py-40 text-center">
                <h3 className="text-5xl font-black uppercase text-zinc-400 italic tracking-tighter">No Upcoming Festivals</h3>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}