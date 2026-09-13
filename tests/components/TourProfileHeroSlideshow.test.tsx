// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TourProfileHeroSlideshow from '@/components/TourProfileHeroSlideshow';

describe('TourProfileHeroSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cycles the active image every 30 seconds', () => {
    render(
      <TourProfileHeroSlideshow
        artistName="Metallica"
        images={['hero.jpg', 'gallery-one.jpg', 'gallery-two.jpg', 'member-one.jpg', 'member-two.jpg']}
      />,
    );

    expect(screen.getByRole('img', { name: 'Metallica tour image 1' })).toBeTruthy();
    expect(screen.getByText(/Showing tour image 1 of 5/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByRole('img', { name: 'Metallica tour image 2' })).toBeTruthy();
    expect(screen.getByText(/Showing tour image 2 of 5/)).toBeTruthy();
  });

  it('deduplicates images and caps the hero at five slides', () => {
    const { container } = render(
      <TourProfileHeroSlideshow
        artistName="Metallica"
        images={['hero.jpg', 'hero.jpg', 'gallery-one.jpg', 'gallery-two.jpg', 'member-one.jpg', 'member-two.jpg', 'venue.jpg']}
      />,
    );

    expect(screen.getByText(/Showing tour image 1 of 5/)).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(5);
  });
});
