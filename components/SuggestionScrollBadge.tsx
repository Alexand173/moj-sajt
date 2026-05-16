'use client';

import { useEffect, useState } from 'react';

export default function SuggestionScrollBadge() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Pojavljuje se čim korisnik skroluje više od 250px od vrha
      if (window.scrollY > 250) {
        setShowPopup(true);
      } else {
        setShowPopup(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToBottom = () => {
    const section = document.getElementById('suggestions-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!showPopup) return null;

  return (
    <div className="fixed bottom-8 right-6 z-[99999] select-none pointer-events-auto">
      <button
        onClick={handleScrollToBottom}
        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 border border-white/10 hover:border-white/20 text-white rounded-full shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 group"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
        </span>

        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 group-hover:text-white">
          Suggestions
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={3}
          stroke="currentColor"
          className="w-3 h-3 text-zinc-400 group-hover:text-white group-hover:translate-y-0.5 transition-all"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
        </svg>
      </button>
    </div>
  );
}