// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/tickets/us');
  vi.restoreAllMocks();
});

const paginatedConcerts = [
  ...concerts,
  ...Array.from({ length: 10 }, (_, index) => ({
    artist_name: `Artist ${index + 4}`,
    image_url: '',
    events: [{
      id: `artist-${index + 4}`,
      date: '2026-12-15',
      location: 'Madison Square Garden, New York, NY',
      city: 'New York',
      ticket_link: `https://ticketmaster.com/artist-${index + 4}`,
    }],
  })),
];

function renderConcertsList(props: Partial<ComponentProps<typeof ConcertsList>> = {}) {
  return render(<ConcertsList dataZaPrikaz={concerts} {...props} />);
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
    expect(new URL(window.location.href).searchParams.get('artist')).toBe('week');
  });

  it('filters ticket cards by city and shows the matching result count', () => {
    renderConcertsList();

    fireEvent.click(screen.getByRole('button', { name: /^Los Angeles$/ }));

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('2 matching artists');
    expect(new URL(window.location.href).searchParams.get('city')).toBe('Los Angeles');
    expect(new URL(window.location.href).searchParams.get('page')).toBeNull();
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

  it('paginates artist cards and persists the page in the URL', () => {
    renderConcertsList({ dataZaPrikaz: paginatedConcerts });

    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByRole('navigation', { name: 'Ticket pages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 3, name: 'Artist 13' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
    expect(new URL(window.location.href).searchParams.get('page')).toBe('2');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search artist' }), {
      target: { value: 'Artist 4' },
    });

    expect(screen.queryByText('Page 1 of 1')).toBeNull();
    expect(new URL(window.location.href).searchParams.get('page')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Artist 4' })).toBeTruthy();
  });

  it('hydrates search and city filters from initial URL values', () => {
    renderConcertsList({ initialSearchQuery: 'week', initialCity: 'Los Angeles' });

    expect(screen.getByRole('searchbox', { name: 'Search artist' })).toHaveProperty('value', 'week');
    expect(screen.getByRole('button', { name: /^Los Angeles$/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('1 matching artist');
  });

  it('renders every valid stored video in the On the road hero and excludes invalid URLs', () => {
    renderConcertsList({
      dataZaPrikaz: [
        { ...concerts[0], video_url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' },
        { ...concerts[1], video_url: 'https://youtu.be/BBBBBBBBBBB' },
        { ...concerts[2], video_url: 'https://vimeo.com/123456789' },
      ],
    });

    const frame = screen.getByTitle('Official The National tour video');
    expect(frame.getAttribute('src')).toBe('https://www.youtube.com/embed/AAAAAAAAAAA?rel=0');
    expect(screen.queryByText('Official YouTube video')).toBeNull();
    expect(frame.getAttribute('allow')).toContain('picture-in-picture');
    expect(frame.getAttribute('allowfullscreen')).not.toBeNull();
    const videoRail = within(screen.getByRole('region', { name: 'On the road videos' }));
    expect(videoRail.getByRole('listbox').className).toContain('mt-video-rail--ticket-strip');
    expect(videoRail.queryByText('YouTube video', { exact: true })).toBeNull();
    expect(videoRail.getAllByRole('option')).toHaveLength(2);
    expect(videoRail.getByRole('option', { name: 'Show The National live preview' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Show The Weeknd live preview' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Show Dua Lipa live preview' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play The National live preview' })).toBeNull();
  });

  it('changes the hero video when a rail item is selected or keyboard-navigated', () => {
    renderConcertsList({
      dataZaPrikaz: [
        { ...concerts[0], video_url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' },
        { ...concerts[1], video_url: 'https://www.youtube.com/watch?v=BBBBBBBBBBB' },
      ],
    });

    fireEvent.click(screen.getByRole('option', { name: 'Show The Weeknd live preview' }));
    expect(screen.getByTitle('Official The Weeknd tour video').getAttribute('src')).toBe('https://www.youtube.com/embed/BBBBBBBBBBB?rel=0');
    expect(screen.getByRole('option', { name: 'Show The Weeknd live preview' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(screen.getByRole('option', { name: 'Show The Weeknd live preview' }), { key: 'ArrowRight' });
    expect(screen.getByTitle('Official The National tour video')).toBeTruthy();
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
