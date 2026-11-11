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
const NIS = { city: 'Niš', regionKey: 'europa', regionLabel: 'Europe' };

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

    expect(await screen.findByText(/Nothing is on sale within reach of Warsaw right now/)).toBeTruthy();
    expect(screen.getByText('No dates within reach')).toBeTruthy();
    // No board is rendered in the empty state, so no list is left dangling.
    expect(screen.queryByRole('list')).toBeNull();
    // The empty result is announced rather than silently skipped.
    expect(screen.getByRole('status').textContent).toBe('No concerts on sale near Warsaw right now.');
  });

  it('says so without inventing a city when the feed fails', async () => {
    stubFeeds(() => jsonResponse({ location: null, events: [] }));

    render(<NearbyEventsRail />);

    expect(await screen.findByText(/The promoter feed has no dates on sale right now/)).toBeTruthy();
    expect(screen.getByText('No dates on sale')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('No concerts on sale right now.');
    // The heading stays, which is what keeps the page title below from moving.
    expect(screen.getByRole('heading', { name: 'Concerts nearby' })).toBeTruthy();
  });
});

describe('NearbyEventsRail board', () => {
  it('names the city the server resolved and shows distance on each row', async () => {
    stubFeeds(() => jsonResponse({
      location: NIS,
      events: [
        {
          id: '1',
          artist: 'Nick Cave',
          venue: 'Sava Centar',
          city: 'Beograd',
          date: '2026-12-01',
          ticketUrl: 'https://tickets.example.com',
          imageUrl: null,
          distanceKm: 240,
        },
        {
          id: '2',
          artist: 'Doja Cat',
          venue: 'Arena',
          city: 'Niš',
          date: '2026-12-05',
          ticketUrl: null,
          imageUrl: null,
          distanceKm: 0,
        },
      ],
    }));

    render(<NearbyEventsRail />);

    // The location line is the visible proof that the geolocation resolved.
    expect(await screen.findByText('Near Niš')).toBeTruthy();
    expect(screen.getByText('Nick Cave')).toBeTruthy();
    // Distance is a column of its own, and a local show reads "in town".
    expect(screen.getAllByText('240 km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('in town').length).toBeGreaterThan(0);
  });
});

describe('NearbyEventsRail city line', () => {
  it('names the city the address resolved to, and says nothing when it could not', async () => {
    stubFeeds(() => jsonResponse({ location: NIS, events: [] }));

    render(<NearbyEventsRail />);

    expect(await screen.findByText('Near Niš')).toBeTruthy();
    expect(screen.queryByText(/Set your city/)).toBeNull();
  });

  it('shows no city line when nothing placed the visitor', async () => {
    stubFeeds(() => jsonResponse({ location: null, events: [] }));

    render(<NearbyEventsRail />);

    // The section still renders its own heading and empty state.
    expect(await screen.findByText('No dates on sale')).toBeTruthy();
    expect(screen.queryByText(/^Near /)).toBeNull();
  });
});
