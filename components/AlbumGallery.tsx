'use client';

import { useState, useEffect } from 'react';

interface AlbumGalleryProps {
  images: string[]; // Niz URL-ova slika iz concert_albums table
  albumName: string;
}

export default function AlbumGallery({ images, albumName }: AlbumGalleryProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Zatvaranje modala na 'Escape' taster i listanje na strelice
  useEffect(() => {
    if (activeIdx === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIdx(null);
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIdx]);

  const handleNext = () => {
    if (activeIdx === null) return;
    setActiveIdx((activeIdx + 1) % images.length);
  };

  const handlePrev = () => {
    if (activeIdx === null) return;
    setActiveIdx((activeIdx - 1 + images.length) % images.length);
  };

  if (!images || images.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      {/* Mreža sličica (Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((url, idx) => (
          <div 
            key={idx} 
            onClick={() => setActiveIdx(idx)}
            className="aspect-square border-4 border-white bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-[4px_4px_0px_0px_rgba(147,51,234,1)] relative group"
          >
            <img 
              src={url} 
              alt={`${albumName} - slika ${idx + 1}`} 
              className="w-full h-full object-cover group-hover:brightness-110 transition-all"
            />
          </div>
        ))}
      </div>

      {/* LIGHTBOX MODAL (Otvara se samo kad klikneš na sliku) */}
      {activeIdx !== null && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center select-none"
          onClick={() => setActiveIdx(null)} // Klik van slike zatvara modal
        >
          {/* Dugme za zatvaranje (X) */}
          <button 
            onClick={() => setActiveIdx(null)}
            className="absolute top-6 right-6 text-white hover:text-purple-400 font-black text-2xl bg-zinc-900/80 border-2 border-white w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95"
          >
            ✕
          </button>

          {/* Kontrole / Strelica LEVO */}
          {images.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className="absolute left-4 md:left-8 text-white hover:text-purple-400 bg-zinc-900/80 border-2 border-white w-14 h-14 rounded-xl flex items-center justify-center transition-all active:scale-95 text-xl font-black"
            >
              ◀
            </button>
          )}

          {/* GLAVNA SLIKA PREKO CELOG EKRANA */}
          <div 
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center justify-center gap-4"
            onClick={(e) => e.stopPropagation()} // Sprečava zatvaranje kad se klikne na samu sliku
          >
            <img 
              src={images[activeIdx]} 
              alt="Full size" 
              className="max-w-full max-h-[80vh] object-contain border-4 border-white rounded-3xl shadow-[0_0_50px_0_rgba(147,51,234,0.3)]"
            />
            
            {/* Brojač slika (npr. 2 / 5) */}
            <span className="bg-white text-black text-xs font-mono font-black px-4 py-1.5 rounded-full uppercase tracking-widest border-2 border-black">
              {activeIdx + 1} / {images.length}
            </span>
          </div>

          {/* Kontrole / Strelica DESNO */}
          {images.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-4 md:right-8 text-white hover:text-purple-400 bg-zinc-900/80 border-2 border-white w-14 h-14 rounded-xl flex items-center justify-center transition-all active:scale-95 text-xl font-black"
            >
              ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
}