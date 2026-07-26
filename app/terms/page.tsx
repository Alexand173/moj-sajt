import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms for using MusicTop charts, voting, community features, news, and event listings.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="MusicTop / Legal"
      title="Terms of Service"
      intro="These terms describe the rules for using MusicTop and the limits of the information and services published on the site."
      updatedAt="July 26, 2026"
    >
      <section>
        <h2>Using MusicTop</h2>
        <p>
          MusicTop provides music charts, audience voting, editorial content, concert and festival information, and community features for informational and entertainment purposes. You agree to use the site lawfully and not to interfere with its operation or security.
        </p>
      </section>

      <section>
        <h2>Accounts and submissions</h2>
        <p>
          You are responsible for keeping your account credentials secure and for activity performed through your account. Do not submit content that is unlawful, abusive, misleading, infringing, or intended to manipulate voting or rankings.
        </p>
        <p className="mt-4">
          By submitting text, images, or suggestions, you confirm that you have the right to share them and grant MusicTop permission to display and use them for operating and promoting the service.
        </p>
      </section>

      <section>
        <h2>Charts, tickets, and external links</h2>
        <p>
          Rankings are based on the signals and voting rules used by MusicTop and may change as data is updated. Event dates, availability, prices, and ticket links are supplied by external providers and may change without notice. MusicTop does not guarantee ticket availability or the accuracy of third-party pages.
        </p>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          MusicTop branding, original editorial material, software, and site design are protected by applicable intellectual property laws. Third-party names, artwork, videos, and trademarks belong to their respective owners.
        </p>
      </section>

      <section>
        <h2>Disclaimer and changes</h2>
        <p>
          The service is provided on an “as available” basis. We may modify, suspend, or remove features and may update these terms when the service changes. Continued use after an update means you accept the revised terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For questions about these terms, email{' '}
          <a className="font-bold underline hover:text-purple-600" href="mailto:contact@musictop.net">
            contact@musictop.net
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
