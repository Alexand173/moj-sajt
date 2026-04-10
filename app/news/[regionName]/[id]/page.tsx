import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
export const revalidate = 3600; // Osveži stranicu na svakih sat vremena (3600 sekundi)
// OVO JE OBAVEZNO: Da bi stranica uvek povukla najnoviju vest iz baze
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function SingleNewsPage({ 
  params 
}: { 
  params: Promise<{ regionName: string, id: string }> 
}) {
  const { id, regionName } = await params;

  // 1. Vučemo vest iz tabele 'news' po ID-u
  const { data: article, error } = await supabase
    .from('news')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !article) {
    return <div className="pt-60 text-center uppercase font-black">Article not found.</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black pt-40 pb-20 font-sans">
      <div className="max-w-[900px] mx-auto px-6">
        
        {/* NAVIGACIJA NAZAD */}
        <Link 
          href={`/news/${regionName}`} 
          className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-purple-600 mb-12 block transition-colors"
        >
          ← Back to {regionName} News Feed
        </Link>

        {/* CATEGORY & TITLE */}
        <span className="text-purple-600 font-black text-xs tracking-[0.4em] uppercase block mb-6">
          {article.category || 'MUSIC INDUSTRY'}
        </span>
        <h1 className="text-5xl md:text-8xl font-black leading-[0.9] uppercase tracking-tighter mb-12">
          {article.title}
        </h1>

        {/* MAIN IMAGE */}
        <div className="aspect-[16/9] mb-16 overflow-hidden bg-zinc-100 shadow-2xl">
          <img 
            src={article.image || `https://images.unsplash.com/photo-1470225620780-dba8ba36b745`} 
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" 
            alt={article.title} 
          />
        </div>

        {/* ARTICLE CONTENT */}
        <div className="max-w-[700px] mx-auto">
          {/* EXCERPT / LEAD PARAGRAPH */}
          <p className="text-2xl md:text-3xl font-bold leading-tight mb-12 border-l-8 border-black pl-8 italic uppercase tracking-tight">
            {article.excerpt}
          </p>

          {/* MAIN TEXT */}
          <div className="text-lg md:text-xl text-zinc-800 leading-relaxed uppercase font-medium space-y-8">
            {/* Čistimo NewsAPI kodove poput [+1234 chars] */}
            {article.content?.replace(/\[\+\d+ chars\]/g, '')}
          </div>

          {/* DUGME ZA ORIGINALNI IZVOR (Call to Action) */}
          <div className="mt-20 p-12 bg-zinc-50 border-t-[12px] border-black text-center">
            <h3 className="font-black text-sm uppercase mb-6 tracking-widest">
              Full Story & Global Impact
            </h3>
            <p className="text-[10px] text-zinc-500 mb-8 uppercase font-bold leading-relaxed">
              This report is part of the MusicTop.net Global News Network. 
              Subscribers get access to full tour dates and exclusive ticket presales.
            </p>
            <button className="w-full bg-black text-white py-6 text-xs font-black uppercase tracking-[0.3em] hover:bg-purple-600 transition-all duration-500 shadow-xl">
              Read Official Full Report
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}