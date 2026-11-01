import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  /** Omit on the final item: the current page never links to itself. */
  href?: string;
};

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** `dark` for ink sections, `light` for paper sections. */
  tone?: 'dark' | 'light';
  className?: string;
}

const TONES = {
  dark: {
    root: 'text-white/45',
    link: 'hover:text-white',
    current: 'text-white',
    separator: 'text-white/25',
  },
  light: {
    root: 'text-muted',
    link: 'hover:text-ink',
    current: 'text-ink',
    separator: 'text-line-strong',
  },
} as const;

/**
 * The visible breadcrumb trail. The list keeps exactly one entry per item so it
 * stays in step with the BreadcrumbList JSON-LD rendered next to it, and the
 * separators are hidden from assistive technology.
 */
export default function Breadcrumbs({ items, tone = 'light', className = '' }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const palette = TONES[tone];

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-[10px] font-bold tracking-[0.16em] uppercase ${palette.root} ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          const isLink = Boolean(item.href) && !isCurrent;

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-x-2">
              {index > 0 && (
                <span aria-hidden="true" className={`select-none ${palette.separator}`}>
                  /
                </span>
              )}
              {isLink ? (
                <Link href={item.href as string} className={`truncate transition-colors ${palette.link}`}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined} className={`truncate ${isCurrent ? palette.current : ''}`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
