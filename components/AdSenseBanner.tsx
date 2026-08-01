// components/AdSenseBanner.tsx
'use client';
import { useEffect } from 'react';

interface AdSenseBannerProps {
  adSlot: string;
}

export default function AdSenseBanner({ adSlot }: AdSenseBannerProps) {
  const adsenseEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const adsWindow = window as Window & { adsbygoogle?: unknown[] };
        adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
        adsWindow.adsbygoogle.push({});
      }
    } catch (err) {
      console.warn('AdSense blokiran ili nije učitan:', err);
    }
  }, [adSlot, adsenseEnabled]);

  if (!adsenseEnabled) return null;

  return (
    <div className="w-full my-6 flex flex-col justify-center items-center min-h-[120px] bg-zinc-900/60 rounded-2xl border-2 border-dashed border-red-600/30 overflow-hidden relative">
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-zinc-950/40">
        <span className="text-[10px] font-black tracking-[0.3em] text-red-500 uppercase mb-1">
          [ SPONSORED ADVERTISEMENT ]
        </span>
        <span className="text-[9px] font-mono text-zinc-600">
          Slot ID: {adSlot}
        </span>
      </div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '120px', position: 'relative', zIndex: 5 }}
        data-ad-client="ca-pub-5019317238845372" // Zameni sa svojim ID-jem kasnije
        data-ad-slot={adSlot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}