'use client';

import { Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';

const faqItems = [
  { id: 'official-tickets', question: 'Where can I buy official concert tickets for 2026 tours?', answer: 'Use the ticket button on the verified date row. It routes to the official Ticketmaster marketplace for that event when a partner link is available.' },
  { id: 'on-sale-times', question: 'When do concert tickets go on sale for UK shows?', answer: 'The announcement rail shows the next general on-sale signal. Always confirm the exact local time and presale requirements with the promoter before joining the queue.' },
  { id: 'presale-codes', question: 'How do I get presale codes for concerts?', answer: 'Promoters and artists usually share presale access through their official mailing lists, fan clubs, venues, or ticketing partners. Never buy a code from a reseller.' },
  { id: 'verified-dates', question: 'Are the concert dates on this page verified?', answer: 'Dates are cross-checked against promoter and official ticketing schedules. Availability can change quickly, so the ticket partner page is the final source of truth.' },
  { id: 'refunds', question: 'Can I get a refund if a concert is cancelled?', answer: 'Refund rules belong to the official ticket seller and promoter. Open the order support link in your confirmation email and keep your original ticket details.' },
];

const guides = [
  { title: 'How to score face-value concert tickets', description: 'The exact playbook — when to queue, which presales to register for, and how to beat the waiting room on high-demand tours.' },
  { title: 'UK arena vs stadium: which seats are worth it?', description: 'A seat-by-seat breakdown of sightlines, sound and value across Wembley, the O2, Co-op Live and Eventim Apollo.' },
  { title: 'Festival tickets 2026 — the full lineup calendar', description: 'Every major UK and European festival, in date order, with on-sale windows and weekend+day ticket pricing.' },
];

export default function TicketFaqGuides() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="border-t border-line bg-white text-ink">
      <div className="mt-container grid gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.9fr)] lg:gap-16 lg:py-20">
        <div>
          <p className="mt-kicker"><span aria-hidden="true">?</span> Ticket FAQ</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-[0.98] tracking-[-0.06em] sm:text-4xl">Everything you need to know before you buy</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Verified answers to the most-searched questions about buying concert tickets — from presale codes to refunds.</p>
          <div className="mt-7 border-t border-line">
            {faqItems.map((item) => {
              const isOpen = openId === item.id;
              const panelId = `ticket-faq-answer-${item.id}`;
              return (
                <div key={item.id} className="border-b border-line">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex w-full items-center justify-between gap-5 py-4 text-left text-sm font-black tracking-tight transition-colors hover:text-accent-red"
                  >
                    <span>{item.question}</span>
                    <Plus aria-hidden="true" className={`size-4 shrink-0 text-accent-blue transition-transform ${isOpen ? 'rotate-45' : ''}`} />
                  </button>
                  {isOpen && <div id={panelId} className="pb-4 pr-10 text-sm leading-relaxed text-muted">{item.answer}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mt-kicker text-accent-blue"><Sparkles aria-hidden="true" className="size-3" /> Guides</p>
          <h2 className="mt-4 text-3xl font-black leading-[0.98] tracking-[-0.06em] sm:text-4xl">Read before the on-sale</h2>
          <div className="mt-7 space-y-3">
            {guides.map((guide) => (
              <div key={guide.title} className="border border-line p-4 transition-colors hover:border-ink">
                <p className="text-[8px] font-black tracking-[0.24em] text-accent-red uppercase">Guide</p>
                <h3 className="mt-3 text-base font-black leading-tight tracking-[-0.03em]">{guide.title}</h3>
                <p className="mt-2 text-[10px] leading-relaxed text-muted">{guide.description}</p>
              </div>
            ))}
            <div className="flex gap-3 border border-line bg-paper-muted p-4">
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-ticket-green" />
              <div>
                <p className="text-sm font-black">100% verified tickets</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">Every link on this page is routed through Ticketmaster&apos;s official verified marketplace. No resellers, no bots, no inflated prices.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
