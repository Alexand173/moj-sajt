import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white text-black border-t-[8px] border-black pt-16 pb-8 overflow-hidden mt-auto">
      <div className="max-w-[1700px] mx-auto px-6">
        
        {/* LOGO SEKCIJA */}
        <div className="mb-12 border-b-2 border-black pb-4">
          <h2 className="text-[10vw] md:text-[8vw] font-black uppercase italic leading-[0.8] tracking-tighter select-none">
            MUSIC<span className="text-purple-600">TOP</span>
          </h2>
          <div className="flex justify-between items-center mt-2 font-black text-[9px] md:text-sm italic uppercase tracking-widest">
            <span>Est. 2026</span>
            <span className="text-purple-600">Global Music Feed</span>
          </div>
        </div>

        {/* --- NOVO: SEO TEXT BLOCK --- */}
        <div className="mb-16 max-w-4xl">
          <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-400 mb-3">About Music Top</h3>
          <p className="text-[13px] md:text-sm leading-relaxed font-medium text-zinc-800">
            Currently most popular songs in all genres including **Rock, Pop, Hip-Hop, R&B/Soul, Country, Dance, J-Pop, J-Rock, K-Pop, Jazz, and Classic**. 
            All world music charts are ranked by audience votes. Follow **MTA awards**, festival announcements, latest music news, and official concert dates for global artists.
          </p>
        </div>

        {/* LINKOVI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          
          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Charts & Genres
            </h4>
            <ul className="flex flex-col gap-1.5 font-bold text-[11px] uppercase">
              <li><Link href="/charts/pop" className="hover:text-purple-600 transition-colors">Pop & Rock</Link></li>
              <li><Link href="/charts/k-pop" className="hover:text-purple-600 transition-colors">K-Pop & J-Pop</Link></li>
              <li><Link href="/charts/hip-hop" className="hover:text-purple-600 transition-colors">Hip-Hop & Soul</Link></li>
              <li><Link href="/charts/jazz" className="hover:text-purple-600 transition-colors">Jazz & Classic</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              MTA Awards
            </h4>
            <ul className="flex flex-col gap-1.5 font-bold text-[11px] uppercase">
              <li><Link href="/news" className="hover:text-purple-600 transition-colors">Latest News</Link></li>
              <li><Link href="/festivals" className="hover:text-purple-600 transition-colors">Festivals 2026</Link></li>
              <li><Link href="/concerts" className="hover:text-purple-600 transition-colors">Concert Dates</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Legal
            </h4>
            <ul className="flex flex-col gap-1.5 font-bold text-[11px] uppercase">
              <li><Link href="/privacy" className="hover:text-purple-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-purple-600 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
              Newsletter
            </h4>
            <div className="flex flex-col gap-2">
              <input 
                type="email" 
                placeholder="YOUR@EMAIL.COM" 
                className="border-b-2 border-black py-1 text-[10px] font-black focus:outline-none focus:border-purple-600 w-full bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div className="pt-6 border-t border-black/5 flex flex-col md:flex-row justify-between gap-4 items-center">
          <div className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
            © {currentYear} MUSICTOP MEDIA GROUP / ALL RIGHTS RESERVED. OFFICIAL MTA SOURCE.
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