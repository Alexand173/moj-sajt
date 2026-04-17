import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const revalidate = 3600;

export default async function ReviewsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: items, error } = await supabase
    .from('news')
    .select('*')
    .or('title.ilike.%review%,title.ilike.%interview%')
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    console.error("Fetch error:", error.message);
  }

  return (
    /* KLJUČNO: overflow-x-hidden na glavnom divu sprečava horizontalni scroll */
    <div className="min-h-screen bg-white text-black font-sans overflow-x-hidden">
      
      {/* HERO SECTION */}
      <section className="bg-white py-24 px-4 border-b-2 border-black relative">
        <div className="max-w-6xl mx-auto">
          {/* POPRAVKA: text-5xl na mobilnom, tek od md: ide na 9xl */}
          <h1 className="text-5xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8] mb-8 break-words">
            Reviews & <br className="hidden md:block" /> Interviews
          </h1>
          <p className="text-black max-w-xl text-sm md:text-lg uppercase tracking-[0.2em] font-bold border-l-4 border-black pl-6">
            In-depth analysis and exclusive conversations.
          </p>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-20">
        {items && items.length > 0 ? (
          /* POPRAVKA: grid-cols-1 na mobilnom je obavezan */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-24">
            {items.map((item) => (
              <article key={item.id} className="group border-b border-black/10 pb-12 hover:border-black transition-colors w-full">
                <div className="flex items-center space-x-4 mb-8">
                  <span className={`text-[10px] md:text-[11px] font-black px-3 py-1 uppercase tracking-widest border-2 ${
                    item.category === 'INTERVIEW' ? 'bg-black text-white border-black' : 'bg-white text-black border-black'
                  }`}>
                    {item.category || 'FEATURE'}
                  </span>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <Link href={item.url || '#'} target="_blank">
                  {/* POPRAVKA: text-3xl na mobilnom za naslove artikala */}
                  <h2 className="text-3xl md:text-4xl font-black leading-[1.1] group-hover:underline decoration-4 underline-offset-8 transition-all mb-6 uppercase tracking-tighter break-words">
                    {item.title}
                  </h2>
                </Link>

                <p className="text-zinc-600 text-base md:text-lg leading-relaxed mb-8 line-clamp-3 font-medium italic">
                   {item.excerpt ? `"${item.excerpt}"` : "Read our full editorial on this latest cultural milestone."}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <Link 
                    href={item.url || '#'} 
                    target="_blank" 
                    className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] border-b-4 border-black pb-1 hover:bg-black hover:text-white transition-all px-1"
                  >
                    Read More
                  </Link>
                  <span className="text-black text-[10px] md:text-xs font-black uppercase italic tracking-widest">
                    {item.region || 'GLOBAL'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-48 border-4 border-black px-4">
            <h3 className="text-2xl md:text-4xl text-black uppercase font-black italic tracking-tighter">
              Archive is being updated.
            </h3>
          </div>
        )}
      </main>

      {/* FOOTER - Smanjen font za mobilni da ne bi pravio overflow */}
      <footer className="py-24 border-t-2 border-black text-center bg-zinc-50 overflow-hidden">
        <div className="text-[18vw] md:text-[14vw] font-black uppercase italic leading-none tracking-tighter text-black select-none">
          Archive
        </div>
      </footer>
    </div>
  );
}