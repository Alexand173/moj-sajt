import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white text-black border-t-[8px] border-black pt-16 pb-8 overflow-hidden mt-auto">
      <div className="max-w-[1700px] mx-auto px-6">
        
        {/* LOGO SEKCIJA - Smanjen font sa 15vw na 8vw / 10vw */}
        <div className="mb-12 border-b-2 border-black pb-4">
          <h2 className="text-[10vw] md:text-[8vw] font-black uppercase italic leading-[0.8] tracking-tighter select-none">
            MUSIC<span className="text-purple-600">TOP</span>
          </h2>
          <div className="flex justify-between items-center mt-2 font-black text-[9px] md:text-sm italic uppercase tracking-widest">
            <span>Est. 2026</span>
            <span className="text-purple-600">Global Music Feed</span>
          </div>
        </div>

        {/* LINKOVI - Čistija i manja mreža */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          
          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Regions
            </h4>
            <ul className="flex flex-col gap-1.5 font-bold text-[11px] uppercase">
              <li><Link href="/news/us" className="hover:text-purple-600 transition-colors">United States</Link></li>
              <li><Link href="/news/uk" className="hover:text-purple-600 transition-colors">United Kingdom</Link></li>
              <li><Link href="/news/asia" className="hover:text-purple-600 transition-colors">Asia Pacific</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Content
            </h4>
            <ul className="flex flex-col gap-1.5 font-bold text-[11px] uppercase">
              <li><Link href="/news/us" className="hover:text-purple-600 transition-colors">Latest News</Link></li>
              <li><Link href="/reviews" className="hover:text-purple-600 transition-colors">Reviews</Link></li>
              <li><Link href="/festivals" className="hover:text-purple-600 transition-colors">Festivals</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Legal
            </h4>
            <ul className="flex flex-col gap-1.5 font-bold text-[11px] uppercase">
              <li><Link href="#" className="hover:text-purple-600 transition-colors">Privacy</Link></li>
              <li><Link href="#" className="hover:text-purple-600 transition-colors">Terms</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Connect
            </h4>
            <div className="flex flex-col gap-2">
              <input 
                type="email" 
                placeholder="NEWSLETTER" 
                className="border-b-2 border-black py-1 text-[10px] font-black focus:outline-none focus:border-purple-600 w-full"
              />
            </div>
          </div>
        </div>

        {/* COPYRIGHT - Minimalistički na dnu */}
        <div className="pt-6 border-t border-black/5 flex flex-col md:flex-row justify-between gap-4 items-center">
          <div className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
            © {currentYear} MUSICTOP MEDIA GROUP / ALL RIGHTS RESERVED.
          </div>
          <div className="flex gap-5 font-black text-[9px] tracking-[0.2em] italic uppercase">
            <span className="cursor-pointer hover:text-purple-600">IG</span>
            <span className="cursor-pointer hover:text-purple-600">TW</span>
            <span className="cursor-pointer hover:text-purple-600">TT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}