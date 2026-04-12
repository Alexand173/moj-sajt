import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Dinamičko osvežavanje na svakih sat vremena
export const revalidate = 3600;

export default async function ReviewsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Povlačimo podatke gde je kategorija ili REVIEW ili INTERVIEW
  // Napomena: Ako tvoj skraper još uvek ne taguje ove kategorije, 
  // privremeno će prikazati prazno dok ne apdejtujemo skraper.
 // Umesto striktne kategorije, tražimo ključne reči u naslovu
  const { data: items, error } = await supabase
    .from('news')
    .select('*')
    .or('title.ilike.%review%,title.ilike.%interview%') // Traži bilo gde u naslovu
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    console.error("Greška pri učitavanju:", error);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero sekcija specifična za Reviews */}
      <section className="bg-zinc-900 py-20 px-4 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter text-yellow-400">
            Reviews & <br /> Interviews
          </h1>
          <p className="mt-6 text-zinc-400 max-w-xl text-lg uppercase tracking-widest">
            Duboke analize, ekskluzivni razgovori i kritike koje definišu zvuk današnjice.
          </p>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {items && items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {items.map((item) => (
              <article key={item.id} className="group border-b border-zinc-800 pb-12">
                <div className="flex items-center space-x-4 mb-6">
                  <span className={`text-xs font-bold px-3 py-1 uppercase tracking-tighter ${
                    item.category === 'INTERVIEW' ? 'bg-blue-600 text-white' : 'bg-yellow-400 text-black'
                  }`}>
                    {item.category}
                  </span>
                  <span className="text-zinc-500 text-xs font-mono uppercase">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <Link href={item.url} target="_blank">
                  <h2 className="text-3xl font-bold leading-tight group-hover:text-yellow-400 transition-colors mb-4">
                    {item.title}
                  </h2>
                </Link>

                <p className="text-zinc-400 text-lg leading-relaxed mb-6 line-clamp-3 italic">
                  "{item.excerpt}"
                </p>

                <div className="flex items-center justify-between">
                  <Link 
                    href={item.url} 
                    target="_blank" 
                    className="text-sm font-black uppercase tracking-widest border-b-2 border-white group-hover:border-yellow-400 transition-all pb-1"
                  >
                    Read Full Story
                  </Link>
                  <span className="text-zinc-600 text-xs font-bold uppercase">
                    Source: {item.region || 'Global'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h3 className="text-2xl text-zinc-600 uppercase font-bold tracking-widest">
              Trenutno nema dostupnih recenzija ili intervjua.
            </h3>
            <p className="text-zinc-800 mt-2">Scraper radi na prikupljanju novog sadržaja...</p>
          </div>
        )}
      </main>

      {/* Footer ukras */}
      <footer className="py-10 border-t border-zinc-900 text-center">
        <div className="text-[10vw] font-black opacity-5 select-none uppercase italic">
          Deep Dive
        </div>
      </footer>
    </div>
  );
}