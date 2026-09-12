// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TicketHeroVideoRail, { type TicketHeroVideoRailVariant } from '@/components/TicketHeroVideoRail';

vi.mock('next/image', () => ({
  default: () => null,
}));

const items = [
  {
    artist: 'Metallica',
    imageUrl: null,
    videoUrl: 'https://www.youtube.com/watch?v=AAAAAAAAAAA',
    title: 'Life Burns Faster',
    venue: 'Sphere · Las Vegas',
  },
  {
    artist: 'Bruno Mars',
    imageUrl: null,
    videoUrl: 'https://youtu.be/BBBBBBBBBBB',
    title: 'The Romantic Tour',
    venue: 'Wembley Stadium · London',
  },
];

const variantClasses: Record<TicketHeroVideoRailVariant, string> = {
  'source-monitor': 'mt-video-rail-item--source-monitor',
  'ticket-strip': 'mt-video-rail-item--ticket-strip',
  'liner-index': 'mt-video-rail-item--liner-index',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TicketHeroVideoRail variants', () => {
  it.each(Object.keys(variantClasses) as TicketHeroVideoRailVariant[])('renders the %s direction', (variant) => {
    render(
      <TicketHeroVideoRail
        items={items}
        activeIndex={0}
        onSelect={vi.fn()}
        variant={variant}
      />,
    );

    const region = screen.getByRole('region', { name: 'On the road videos' });
    const listbox = within(region).getByRole('listbox');
    const options = within(listbox).getAllByRole('option');

    expect(listbox.className).toContain(`mt-video-rail--${variant}`);
    expect(options).toHaveLength(2);
    expect(options[0].className).toContain(variantClasses[variant]);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('aria-setsize')).toBe('2');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
  });

  it('keeps click and RTL keyboard navigation shared across directions', () => {
    const onSelect = vi.fn();

    render(
      <TicketHeroVideoRail
        items={items}
        activeIndex={0}
        onSelect={onSelect}
        variant="liner-index"
      />,
    );

    const options = screen.getAllByRole('option');
    fireEvent.click(options[1]);
    expect(onSelect).toHaveBeenLastCalledWith(1);

    fireEvent.keyDown(options[0], { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith(1);
  });
});
