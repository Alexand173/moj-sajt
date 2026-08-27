import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import LegalPage from '@/components/LegalPage';
import { getNewsletterSignupUrl } from '@/lib/newsletter';

export const metadata: Metadata = {
  title: 'MusicTop Newsletter',
  description: 'Join the MusicTop newsletter for new music, chart movements, tours, festivals, and editorial picks.',
  alternates: { canonical: '/newsletter' },
};

export default function NewsletterPage() {
  const signupUrl = getNewsletterSignupUrl();

  return (
    <LegalPage
      eyebrow="MusicTop / Newsletter"
      title="The signal, weekly"
      intro="A concise dispatch of the songs, stories, tours, and festival moments shaping the global music conversation."
      updatedAt="August 27, 2026"
    >
      <section>
        <h2>One email. The signal.</h2>
        <p>
          The MusicTop newsletter brings the strongest chart movements, source-attributed music news, live dates, and editorial recommendations into one focused update. We keep the list independent from the site&apos;s account and voting features.
        </p>
        {signupUrl ? (
          <a
            href={signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex min-h-14 items-center gap-3 bg-black px-6 py-4 text-[10px] font-black tracking-[0.2em] text-white uppercase transition-colors hover:bg-purple-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-600"
          >
            Open newsletter signup
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        ) : (
          <div className="mt-7 border-2 border-black bg-zinc-100 p-5 text-sm leading-relaxed text-zinc-700">
            <p>The external newsletter signup is being connected. For launch or partnership questions, contact the MusicTop team.</p>
            <Link href="/contact" className="mt-4 inline-flex items-center gap-2 font-black uppercase tracking-[0.14em] text-black underline decoration-purple-600 decoration-2 underline-offset-4 hover:text-purple-600">
              Contact MusicTop
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2>What to expect</h2>
        <ul>
          <li>Weekly chart signals and new music worth a closer listen.</li>
          <li>Selected news, tours, festivals, and reviews from the MusicTop editorial desk.</li>
          <li>Clear unsubscribe controls managed by the newsletter provider.</li>
        </ul>
      </section>

      <section>
        <h2>Before you subscribe</h2>
        <p>
          Signup takes place on the external newsletter provider configured by MusicTop. Review that provider&apos;s privacy notice and consent options before submitting your email. Read our <Link href="/privacy" className="font-bold underline hover:text-purple-600">Privacy Policy</Link> for how MusicTop handles information across the rest of the site.
        </p>
      </section>
    </LegalPage>
  );
}
