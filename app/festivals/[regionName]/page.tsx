import { createClient } from '@supabase/supabase-js';

// Inicijalizacija Supabase klijenta
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function FestivalsPage({ 
  params 
}: { 
  params: Promise<{ regionName: string }> 
}) {
  
  // 1. "Otključavamo" params jer je u Next.js 15 to Promise
  const resolvedParams = await params;
  const region = resolvedParams.regionName;

  // 2. Povlačimo festivale iz Supabase baze za taj region
  const { data: festivals, error } = await supabase
    .from('festivals')
    .select('*')
    .eq('region', region);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Naslov stranice sa tvojim ljubičastim dizajnom */}
      <h1 className="text-6xl font-black mb-12 uppercase tracking-tighter text-purple-600">
        Upcoming Festivals: {region ? region.toUpperCase() : 'WORLD'}
      </h1>

      {/* Grid sistem za prikaz festivala */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {festivals && festivals.length > 0 ? (
          festivals.map((fest) => (
            <div key={fest.id} className="group border-b border-white/10 pb-8 hover:border-purple-500 transition-all duration-300">
              
              {/* Slika festivala sa grayscale efektom koji nestaje na hover */}
              <div className="relative h-72 w-full overflow-hidden mb-6 bg-zinc-900">
                <img 
                  src={fest.image_url || 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3'} 
                  alt={fest.name}
                  className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 scale-110 group-hover:scale-100"
                />
                {/* Badge za datum preko slike */}
                <div className="absolute bottom-4 left-4 bg-purple-600 text-black px-3 py-1 font-black text-sm uppercase">
                   {new Date(fest.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Informacije o festivalu */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
                  {fest.location || 'Location TBA'}
                </p>
                <h2 className="text-4xl font-black uppercase italic leading-none tracking-tighter group-hover:text-purple-400 transition-colors">
                  {fest.name}
                </h2>
                
                <p className="text-zinc-400 text-sm line-clamp-2 mt-2 font-medium">
                  {fest.description || 'Join the ultimate music experience this season.'}
                </p>

                {/* Dugme za akciju */}
                <div className="mt-6">
                  <a 
                    href={fest.tickets_url || '#'} 
                    target="_blank"
                    className="inline-block border border-white px-6 py-2 font-black text-sm uppercase hover:bg-white hover:text-black transition-all"
                  >
                    Get Tickets →
                  </a>
                </div>
              </div>
            </div>
          ))
        ) : (
          /* Poruka ako nema festivala u bazi */
          <div className="col-span-full py-20 border-2 border-dashed border-zinc-800 text-center">
            <p className="text-zinc-500 font-mono uppercase tracking-widest">
              No festivals found for {region.toUpperCase()} region.
            </p>
            <p className="text-sm text-zinc-600 mt-2">Run the scraper to populate this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}