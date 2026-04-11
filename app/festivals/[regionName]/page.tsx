import { createClient } from '@supabase/supabase-js';
import Link from 'next/link'; // OVO JE FALILO I IZAZVALO GREŠKU

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function RegionalFestivalsPage({ 
  params 
}: { 
  params: Promise<{ regionName: string }> 
}) {
  const { regionName } = await params;
  const region = regionName.toLowerCase();

  // Vučemo festivale za taj region iz kolone 'region'
  const { data: festivals, error } = await supabase
    .from('festivals')
    .select('*')
    .eq('region', region)
    .order('date_start', { ascending: true });

  if (error) return <div className="pt-60 text-center uppercase font-black text-red-500">Error loading festivals</div>;

  return (
    <div className="min-h-screen bg-white text-black pt-52 pb-40 font-sans">
      <div className="max-w-[1400px] mx-auto px-6">
        
        {/* HEADER SEKCIJA */}
        <div className="border-b-[12px] border-black mb-20 pb-8 flex justify-between items-baseline">
          <h1 className="text-[12vw] md:text-[10rem] font-black uppercase tracking-tighter leading-[0.8]">
            {region}<span className="text-purple-600">.</span>Fest
          </h1>
          <span className="font-black uppercase text-xs tracking-[0.3em] text-zinc-400 hidden md:block">
            2026 Global Guide
          </span>
        </div>

        {/* LISTA FESTIVALA */}
        <div className="divide-y-[1px] divide-zinc-200">
          {festivals && festivals.length > 0 ? (
            festivals.map((fest) => (
              <Link 
                key={fest.id} 
                href={`/festivals/${region}/${fest.id}`} // LINK KA DETALJNOJ STRANICI
                className="group grid grid-cols-1 md:grid-cols-12 py-16 items-center hover:bg-zinc-50 transition-all px-4"
              >
                {/* DATUM */}
                <div className="md:col-span-2">
                  <span className="text-2xl font-black uppercase tracking-tighter group-hover:text-purple-600 transition-colors">
                    {new Date(fest.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* NAZIV I LOKACIJA */}
                <div className="md:col-span-7">
                  <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-2">
                    {fest.name}
                  </h2>
                  <span className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                    {fest.location}
                  </span>
                </div>

                {/* CTA DUGME */}
                <div className="md:col-span-3 flex md:justify-end mt-8 md:mt-0">
                  <div className="bg-black text-white px-10 py-5 text-xs font-black uppercase tracking-[0.2em] group-hover:bg-purple-600 transition-all shadow-2xl">
                    Details & Tickets
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="py-40 text-center">
              <h3 className="text-4xl font-black uppercase text-zinc-200 italic">No Festivals Found</h3>
              <p className="mt-4 uppercase font-bold text-xs tracking-widest text-zinc-400">Updating database shortly...</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}