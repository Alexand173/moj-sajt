import { Activity, CloudRain, TrendingUp } from 'lucide-react';

const pulseItems = [
  { label: 'LIVE NATION', value: '+2.4%', icon: TrendingUp, tone: 'up' },
  { label: 'STREAMS', value: '1.2B', icon: Activity, tone: 'neutral' },
  { label: 'GLASTO', value: '14°C', icon: CloudRain, tone: 'neutral' },
  { label: 'SPOTIFY', value: '+0.8%', icon: TrendingUp, tone: 'up' },
  { label: 'VINYL SALES', value: '+11%', icon: TrendingUp, tone: 'up' },
] as const;

export default function TickerSpine() {
  return (
    <aside aria-label="Global music pulse" className="pointer-events-none fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-6 px-2 py-6 mix-blend-difference xl:flex">
      <span className="vertical-text rotate-180 text-[9px] font-bold tracking-[0.3em] text-white uppercase">Global pulse</span>
      <div className="flex flex-col gap-4 border-l border-line pl-3">
        {pulseItems.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex flex-col items-start">
            <span className="flex items-center gap-1 text-[8px] font-bold tracking-[0.14em] text-muted uppercase">
              <Icon aria-hidden="true" className="size-2.5 text-muted" />
              {label}
            </span>
            <span className={`text-[11px] font-black tabular-nums ${tone === 'up' ? 'text-accent-blue' : 'text-white'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
