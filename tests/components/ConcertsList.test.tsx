// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConcertsList from '@/components/ConcertsList';

vi.mock('next/image', () => ({
  default: () => null,
}));

const concerts = [
  {
    artist_name: 'The National',
    image_url: '',
    events: [
      {
        id: 'national-new-york',
        date: '2026-09-20',
        location: 'Madison Square Garden, New York, NY',
        city: 'New York',
        ticket_link: 'https://ticketmaster.com/national-new-york',
      },
      {
        id: 'national-los-angeles',
        date: '2026-10-04',
        location: 'Hollywood Bowl, Los Angeles, CA',
        city: 'Los Angeles',
        ticket_link: '',
      },
    ],
  },
  {
    artist_name: 'The Weeknd',
    image_url: '',
    events: [
      {
        id: 'weeknd-los-angeles',
        date: '2026-11-12',
        location: 'SoFi Stadium, Los Angeles, CA',
        city: 'Los Angeles',
        ticket_link: 'https://ticketmaster.com/weeknd-los-angeles',
      },
    ],
  },
  {
    artist_name: 'Dua Lipa',
    image_url: '',
    events: [
      {
        id: 'dua-london',
        date: '2026-12-01',
        location: 'Wembley Stadium, London, UK',
        city: 'London',
      },
    ],
  },
];

afterEach(() => {
  cleanup();
});

function renderConcertsList() {
  return render(<ConcertsList dataZaPrikaz={concerts} />);
}

describe('ConcertsList filtering', () => {
  it('filters ticket cards by artist and shows the matching result count', () => {
    renderConcertsList();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search artist' }), {
      target: { value: 'week' },
    });

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 3, name: 'The Weeknd' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3, name: 'The National' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('1 matching artist');
  });

  it('filters ticket cards by city and shows the matching result count', () => {
    renderConcertsList();

    fireEvent.click(screen.getByRole('button', { name: /^Los Angeles$/ }));

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('2 matching artists');
    expect(screen.getByRole('heading', { level: 3, name: 'The National' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'The Weeknd' })).toBeTruthy();
  });

  it('combines artist and city filters while keeping only matching events', () => {
    renderConcertsList();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search artist' }), {
      target: { value: 'national' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Los Angeles$/ }));

    const card = screen.getByRole('article');
    expect(screen.getByRole('status').textContent).toBe('1 matching artist');
    expect(within(card).getByText('Hollywood Bowl, Los Angeles, CA')).toBeTruthy();
    expect(within(card).queryByText('Madison Square Garden, New York, NY')).toBeNull();
  });

  it('renders the empty state and zero result count for an unmatched artist', () => {
    renderConcertsList();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search artist' }), {
      target: { value: 'Missing Artist' },
    });

    expect(screen.getByText('No artists matching "Missing Artist".')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('0 matching artists');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });
});

describe('ConcertsList ticket actions', () => {
  it('disables ticket actions when an event has no ticket link', () => {
    renderConcertsList();

    const unavailableNationalTickets = screen.getByRole('button', { name: 'Tickets unavailable for The National' });
    const unavailableDuaTickets = screen.getByRole('button', { name: 'Tickets unavailable for Dua Lipa' });

    expect(unavailableNationalTickets).toHaveProperty('disabled', true);
    expect(unavailableDuaTickets).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('link', { name: 'Tickets' })).toHaveLength(2);
  });
});
