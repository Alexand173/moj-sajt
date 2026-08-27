import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const sectionLinks = [
  { label: 'News', href: '/news/us' },
  { label: 'Tours', href: '/tours/us' },
  { label: 'Festivals', href: '/festivals/us' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'MTA Awards', href: '/awards' },
  { label: 'Jazz', href: '/region/jazz' },
  { label: 'Classical', href: '/region/classical' },
];

const regionLinks = [
  { label: 'US', href: '/region/us/rock' },
  { label: 'UK', href: '/region/uk/rock' },
  { label: 'Europa', href: '/region/europa/germany/rock' },
  { label: 'Latino', href: '/region/latino/rock' },
  { label: 'Asia', href: '/region/asia/j-pop' },
  { label: 'World', href: '/region/world/rock' },
];

const platformLinks = [
  { label: 'About MusicTop', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
];

const socialLinks = [
  { label: 'Instagram' },
  { label: 'TikTok' },
  { label: 'YouTube' },
  { label: 'RSS' },
];

function FooterLink({ label, href }: { label: string; href?: string }) {
  if (!href) {
    return <span className="text-sm font-bold tracking-tight text-white/75">{label}</span>;
  }

  const isExternal = href.startsWith('http');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-white/75 transition-colors hover:text-white"
      >
        {label}
        <ArrowUpRight aria-hidden="true" className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-white/75 transition-colors hover:text-white"
    >
      {label}
      <ArrowUpRight aria-hidden="true" className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href?: string }> }) {
  return (
    <div>
      <h3 className="mb-5 text-[9px] font-black tracking-[0.3em] text-white/40 uppercase">{title}</h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <FooterLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink text-white">
      <div className="mt-container py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-block text-5xl font-black leading-none tracking-[-0.09em] transition-opacity hover:opacity-80 lg:text-7xl">
              MUSIC<span className="text-accent-red">TOP</span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
              The kinetic chronicle of global music journalism — raw, urgent, unfiltered. Built for readers who treat every headline as a monument.
            </p>
            <div className="mt-6 flex max-w-md items-center gap-2">
              <label htmlFor="footer-email" className="sr-only">Email address</label>
              <input
                id="footer-email"
                type="email"
                placeholder="YOUR EMAIL"
                className="min-w-0 flex-1 border border-white/20 bg-transparent px-4 py-3 text-[10px] font-bold tracking-[0.16em] text-white placeholder:text-white/30 focus:border-accent-red focus:outline-none"
              />
              <button type="button" className="shrink-0 bg-accent-red px-5 py-3 text-[10px] font-black tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-ink">
                JOIN
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8 lg:grid-cols-4">
            <FooterColumn title="Sections" links={sectionLinks} />
            <FooterColumn title="Regions" links={regionLinks} />
            <FooterColumn title="Platform" links={platformLinks} />
            <FooterColumn title="Follow" links={socialLinks} />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mt-container flex flex-col items-start justify-between gap-4 py-6 text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase sm:flex-row sm:items-center">
          <span>© {currentYear} MUSIC TOP MEDIA · ISSUE Nº 0842</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <Link href="/contact" className="transition-colors hover:text-white">Contact</Link>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent-red" aria-hidden="true" />
              All systems live
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
