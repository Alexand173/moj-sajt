import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How MusicTop collects, uses, and protects visitor and account information.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="MusicTop / Legal"
      title="Privacy Policy"
      intro="This policy explains what information MusicTop collects, why we use it, and the choices available to visitors and registered members."
      updatedAt="August 27, 2026"
    >
      <section>
        <h2>Information we collect</h2>
        <p>
          We may collect information you provide when you create an account, submit a song suggestion, vote, join a community discussion, or contact us. This can include your name, email address, profile image, and the content you submit.
        </p>
        <p className="mt-4">
          We also receive limited technical information such as browser type, device information, approximate location, pages visited, and referral information. This helps us keep MusicTop secure and understand how the service is used.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>To operate charts, voting, accounts, news, event listings, and community features.</li>
          <li>To respond to requests, prevent abuse, and maintain site security.</li>
          <li>To measure site performance and improve the usefulness of our content.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          MusicTop and its service providers may use cookies or similar technologies for authentication, preferences, analytics, and security. We do not currently display third-party advertising on MusicTop.
        </p>
        <p className="mt-4">
          You can manage cookies through your browser settings. Blocking some cookies may affect account or interactive features.
        </p>
      </section>

      <section>
        <h2>Third-party services and links</h2>
        <p>
          MusicTop may use Supabase for account and application data, Vercel for hosting and analytics, and external services such as YouTube, Spotify, Ticketmaster, Apple, or news publishers for media and event information. External websites have their own privacy policies, and we are not responsible for their practices.
        </p>
      </section>

      <section>
        <h2>Newsletter signups</h2>
        <p>
          If you choose to join the MusicTop newsletter, signup takes place on the external newsletter provider configured for the service. That provider collects and processes your email under its own privacy notice, consent controls, and unsubscribe process. MusicTop does not store newsletter subscriber data in its Supabase database through the website signup flow.
        </p>
      </section>

      <section>
        <h2>Data retention and your choices</h2>
        <p>
          We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and protect the site. You may request access, correction, or deletion of your account information by contacting us at{' '}
          <a className="font-bold underline hover:text-purple-600" href="mailto:contact@musictop.net">
            contact@musictop.net
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy can be sent to{' '}
          <a className="font-bold underline hover:text-purple-600" href="mailto:contact@musictop.net">
            contact@musictop.net
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
