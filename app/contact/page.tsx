import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Contact MusicTop',
  description: 'Contact MusicTop about corrections, suggestions, partnerships, privacy, or account support.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="MusicTop / Contact"
      title="Contact Us"
      intro="Send us a correction, chart suggestion, partnership request, or question about your account and privacy choices."
      updatedAt="July 26, 2026"
    >
      <section>
        <h2>General support</h2>
        <p>
          For account help, content corrections, voting questions, or general feedback, email{' '}
          <a className="font-bold underline hover:text-purple-600" href="mailto:contact@musictop.net">
            contact@musictop.net
          </a>
          . Include the page URL and enough detail for us to understand the issue.
        </p>
      </section>

      <section>
        <h2>Content and event corrections</h2>
        <p>
          If an artist, song, concert, festival, date, ticket link, or news source is inaccurate, please include the affected title and the correct source. We review corrections before changing published information.
        </p>
      </section>

      <section>
        <h2>Privacy requests</h2>
        <p>
          To request access, correction, or deletion of personal information, use the same email address and write “Privacy request” in the subject line. We may need to verify the request before taking action.
        </p>
      </section>
    </LegalPage>
  );
}
