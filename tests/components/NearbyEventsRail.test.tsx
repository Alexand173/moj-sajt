// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NearbyEventsRail from '@/components/NearbyEventsRail';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}));

function jsonResponse(body: Record<string, unknown>): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const WARSAW = { city: 'Warsaw', regionKey: 'uk', regionLabel: 'the UK' };

function stubFeeds(nearby: () => Response | Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn((input: unknown) => (
    String(input).includes('/api/events/nearby')
      ? Promise.resolve(nearby())
      : Promise.resolve(jsonResponse({ authenticated: false, ids: [], persisted: false }))
  )));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NearbyEventsRail empty states', () => {
  it('holds its slot with a named empty state when the feed has no dates', async () => {
    stubFeeds(() => jsonResponse({ location: WARSAW, events: [] }));

    render(<NearbyEventsRail className="mt-8" />);

    expect(await screen.findByText(/No dates are on sale within reach of Warsaw right now/)).toBeTruthy();
    expect(screen.getByText('Nothing on sale nearby')).toBeTruthy();
    // The rail list and its arrows are gone, so no carousel is left dangling.
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'More nearby events' })).toBeNull();
    // The empty result is announced rather than silently skipped.
    expect(screen.getByRole('status').textContent).toBe('No concerts on sale near Warsaw right now.');
  });

  it('says so without inventing a city when the feed fails', async () => {
    stubFeeds(() => jsonResponse({ location: null, events: [] }));

    render(<NearbyEventsRail />);

    expect(await screen.findByText(/The promoter feed has no dates on sale right now/)).toBeTruthy();
    expect(screen.getByText('Nothing on sale right now')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('No concerts on sale right now.');
    // The heading stays, which is what keeps the page title below from moving.
    expect(screen.getByRole('heading', { name: 'Concerts nearby' })).toBeTruthy();
  });
});
