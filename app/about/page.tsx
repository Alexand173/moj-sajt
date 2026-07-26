import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'About MusicTop',
  description: 'Learn how MusicTop publishes global music charts, news, concerts, and festival guides.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="MusicTop / About"
      title="About MusicTop"
      intro="MusicTop is a global music discovery platform for audience-ranked charts, editorial music news, live events, and festival guides."
      updatedAt="July 26, 2026"
    >
      <section>
        <h2>What we publish</h2>
        <p>
          Our charts organize songs by region and genre so listeners can discover what is being discussed and played around the world. We also publish source-attributed music news, reviews, concert dates, and festival information in one place.
        </p>
      </section>

      <section>
        <h2>How rankings work</h2>
        <p>
          Chart positions are determined from audience engagement and voting data associated with each chart. We update the underlying catalog regularly and may remove or correct entries when information is incomplete or no longer relevant.
        </p>
      </section>

      <section>
        <h2>Editorial approach</h2>
        <p>
          MusicTop links readers to original publishers and event partners. News pages identify their source, while our editorial presentation is intended to add context and make music information easier to explore.
        </p>
      </section>

      <section>
        <h2>Get in touch</h2>
        <p>
          Suggestions, corrections, and partnership questions are welcome at{' '}
          <a className="font-bold underline hover:text-purple-600" href="mailto:contact@musictop.net">
            contact@musictop.net
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
