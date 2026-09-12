'use client';

import { ArrowUpRight, Bell } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface TicketAlertCtaProps {
  signupUrl?: string | null;
}

export default function TicketAlertCta({ signupUrl }: TicketAlertCtaProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = /\S+@\S+\.\S+/.test(email.trim());
    if (!isValid) {
      setHasError(true);
      setMessage('Enter a valid email address.');
      return;
    }
    setHasError(false);
    setMessage(signupUrl ? 'Thanks — continue to the secure signup to finish.' : 'Thanks — your alert request is ready. Signup is being connected.');
  };

  return (
    <section aria-labelledby="ticket-alert-title" className="bg-accent-red text-white">
      <div className="mt-container grid gap-10 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(25rem,0.9fr)] lg:items-center lg:gap-16 lg:py-20">
        <div>
          <p className="flex items-center gap-2 text-[9px] font-black tracking-[0.24em] uppercase"><Bell aria-hidden="true" className="size-3" /> Never miss an on-sale</p>
          <h2 id="ticket-alert-title" className="mt-5 max-w-xl text-5xl font-black leading-[0.88] tracking-[-0.07em] sm:text-6xl lg:text-7xl">Get concert alerts before everyone else</h2>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/85">Join 84,000+ fans who get the drop on presale codes, new tour announcements and last-minute ticket releases — sent the second they&apos;re confirmed.</p>
        </div>

        <div className="bg-ink p-6 sm:p-8">
          <p className="text-[9px] font-black tracking-[0.22em] text-white/55 uppercase">Your email</p>
          <form onSubmit={handleSubmit} noValidate className="mt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="ticket-alert-email" className="sr-only">Email address</label>
                <input
                  id="ticket-alert-email"
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setHasError(false); setMessage(''); }}
                  placeholder="you@example.com"
                  aria-invalid={hasError}
                  className="min-h-12 w-full border-b border-white/30 bg-transparent px-0 text-sm text-white placeholder:text-white/35 focus:border-white focus:outline-hidden"
                />
              </div>
              <button type="submit" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-accent-red px-5 text-[10px] font-black tracking-[0.16em] text-white uppercase transition-colors hover:bg-white hover:text-ink">Alert me <ArrowUpRight aria-hidden="true" className="size-3.5" /></button>
            </div>
            <p aria-live="polite" className={`mt-4 text-[10px] leading-relaxed ${hasError ? 'text-red-200' : 'text-white/60'}`}>{message || 'By subscribing you agree to receive concert announcements from MusicTop. Unsubscribe anytime.'}</p>
            {message && !hasError && signupUrl && <a href={signupUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-[10px] font-black tracking-[0.14em] text-white uppercase underline underline-offset-4">Continue to signup <ArrowUpRight aria-hidden="true" className="size-3" /></a>}
          </form>
        </div>
      </div>
    </section>
  );
}
