import Link from 'next/link';
import type { ReactNode } from 'react';

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updatedAt: string;
  children: ReactNode;
};

export default function LegalPage({
  eyebrow,
  title,
  intro,
  updatedAt,
  children,
}: LegalPageProps) {
  return (
    <article className="min-h-screen bg-white text-black pt-44 pb-24">
      <div className="mx-auto max-w-4xl px-6">
        <Link
          href="/"
          className="inline-flex border-b-2 border-black pb-2 text-[10px] font-black uppercase tracking-[0.3em] transition-colors hover:border-purple-600 hover:text-purple-600"
        >
          ← Back to MusicTop
        </Link>

        <header className="mt-16 border-b-4 border-black pb-10">
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-purple-600">
            {eyebrow}
          </p>
          <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-8xl">
            {title}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-600">
            {intro}
          </p>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">
            Last updated: {updatedAt}
          </p>
        </header>

        <div className="mt-14 space-y-12 text-base leading-8 text-zinc-800 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:uppercase [&_h2]:leading-tight [&_h2]:tracking-tight [&_h3]:mb-2 [&_h3]:font-black [&_h3]:uppercase [&_h3]:tracking-wide [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </div>
    </article>
  );
}
