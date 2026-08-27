import { Trophy } from 'lucide-react';

export interface CountdownValues {
  d: number;
  h: number;
  m: number;
  s: number;
}

interface AwardsHeroProps {
  timeLeft: CountdownValues;
}

export default function AwardsHero({ timeLeft }: AwardsHeroProps) {
  const segments = [
    { value: timeLeft.d, label: 'Days' },
    { value: timeLeft.h, label: 'Hours' },
    { value: timeLeft.m, label: 'Mins' },
    { value: timeLeft.s, label: 'Secs' },
  ];

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-ink">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgb(255_193_7_/_0.08),transparent_48%),radial-gradient(circle_at_80%_80%,rgb(230_57_70_/_0.06),transparent_45%)]" />
      <div className="relative mx-auto max-w-[1200px] px-6 py-16 text-center sm:py-20 lg:py-24">
        <div className="flex items-center justify-center gap-3 text-awards-gold"><Trophy aria-hidden="true" className="size-4" /><span className="text-[9px] font-black tracking-[0.3em] uppercase">The 2026 season</span><Trophy aria-hidden="true" className="size-4" /></div>
        <h1 className="mt-6 text-[clamp(3.25rem,8vw,7rem)] font-black leading-[0.84] tracking-[-0.08em] text-transparent uppercase" style={{ backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #ffc107 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text' }}>Music Top Awards</h1>
        <div className="mx-auto mt-10 inline-flex max-w-full items-stretch gap-1 rounded-2xl border border-white/10 bg-ink-elevated px-3 py-4 sm:gap-3 sm:px-6 sm:py-5">
          {segments.map((segment, index) => <span key={segment.label} className="flex items-center gap-1 sm:gap-3"><span className="flex min-w-14 flex-col items-center sm:min-w-20"><strong className="text-2xl font-black tabular-nums text-white sm:text-5xl">{String(segment.value).padStart(2, '0')}</strong><small className="mt-1 text-[8px] font-bold tracking-[0.18em] text-white/40 uppercase">{segment.label}</small></span>{index < segments.length - 1 && <span className="text-2xl font-black text-white/20 sm:text-4xl">:</span>}</span>)}
        </div>
        <p className="mt-5 text-[9px] font-bold tracking-[0.3em] text-white/40 uppercase">Until global winners announcement</p>
      </div>
    </section>
  );
}
