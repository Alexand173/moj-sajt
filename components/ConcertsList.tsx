'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { resolveConcertCity } from '@/lib/concert-city';
import type { GroupedConcert, HeroItem } from '@/components/ticket-types';
import TicketAnnouncements from '@/components/TicketAnnouncements';
import TicketAlertCta from '@/components/TicketAlertCta';
import TicketCityFilters from '@/components/TicketCityFilters';
import TicketFaqGuides from '@/components/TicketFaqGuides';
import TicketHero from '@/components/TicketHero';
import TicketSearchForm from '@/components/TicketSearchForm';
import LivePreviewRail from '@/components/LivePreviewRail';
import OfficialTicketDates from '@/components/OfficialTicketDates';
import TrendingOnSale from '@/components/TrendingOnSale';
import { getYouTubeVideoId } from '@/lib/news-media';

const ARTISTS_PER_PAGE = 12;

interface ConcertsListProps {
  dataZaPrikaz: GroupedConcert[];
  initialSearchQuery?: string;
  initialCity?: string | null;
  initialPage?: number;
  regionName?: string;
  newsletterSignupUrl?: string | null;
}

function normalizePage(value: number | undefined): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 1;
}


export default function ConcertsList({
  dataZaPrikaz,
  initialSearchQuery = '',
  initialCity = null,
  initialPage = 1,
  regionName = 'us',
  newsletterSignupUrl = null,
}: ConcertsListProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery.trim());
  const [selectedCity, setSelectedCity] = useState<string | null>(initialCity?.trim() || null);
  const [currentPage, setCurrentPage] = useState(normalizePage(initialPage));

  const updateUrl = useCallback((nextSearchQuery: string, nextCity: string | null, nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    const normalizedQuery = nextSearchQuery.trim();
    const normalizedCity = nextCity?.trim() || '';
    const normalizedPage = normalizePage(nextPage);

    if (normalizedQuery) params.set('artist', normalizedQuery);
    else params.delete('artist');
    if (normalizedCity) params.set('city', normalizedCity);
    else params.delete('city');
    if (normalizedPage > 1) params.set('page', String(normalizedPage));
    else params.delete('page');

    const queryString = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`);
  }, []);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const cities = useMemo(() => {
    const cityMap = new Map<string, string>();
    (dataZaPrikaz || []).forEach((group) => {
      group.events.forEach((event) => {
        const city = resolveConcertCity(event.city, event.location);
        if (city && !cityMap.has(city.toLowerCase())) cityMap.set(city.toLowerCase(), city);
      });
    });
    return Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b));
  }, [dataZaPrikaz]);

  const activeCity = selectedCity
    ? cities.find((city) => city.toLowerCase() === selectedCity.toLowerCase()) || null
    : null;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    updateUrl(value, activeCity, 1);
  };

  const handleCityChange = (city: string | null) => {
    setSelectedCity(city);
    setCurrentPage(1);
    updateUrl(searchQuery, city, 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(normalizePage(page));
    updateUrl(searchQuery, activeCity, page);
    const section = document.getElementById('official-ticket-dates');
    if (section && typeof section.scrollIntoView === 'function') section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filteredData = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return (dataZaPrikaz || [])
      .filter((group) => !normalizedQuery || group.artist_name.toLowerCase().includes(normalizedQuery))
      .map((group) => ({
        ...group,
        events: activeCity
          ? group.events.filter((event) => resolveConcertCity(event.city, event.location)?.toLowerCase() === activeCity.toLowerCase())
          : group.events,
      }))
      .filter((group) => group.events.length > 0);
  }, [dataZaPrikaz, activeCity, searchQuery]);

  const normalizedSearchQuery = searchQuery.trim();
  const hasActiveFilters = Boolean(normalizedSearchQuery || activeCity);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ARTISTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice(
    (safeCurrentPage - 1) * ARTISTS_PER_PAGE,
    safeCurrentPage * ARTISTS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > totalPages) updateUrl(searchQuery, activeCity, totalPages);
  }, [activeCity, currentPage, searchQuery, totalPages, updateUrl]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity(null);
    setCurrentPage(1);
    updateUrl('', null, 1);
  };

  const emptyStateMessage = normalizedSearchQuery && activeCity
    ? `No artists matching "${normalizedSearchQuery}" with events in ${activeCity}.`
    : normalizedSearchQuery
      ? `No artists matching "${normalizedSearchQuery}".`
      : activeCity
        ? `No concerts found in ${activeCity}.`
        : 'No concerts found for this region.';

  const heroItems = useMemo<HeroItem[]>(() => {
    const fallbacks: HeroItem[] = [
      { artist: 'Bruno Mars', imageUrl: null, title: 'The Romantic Tour · Live from Wembley', venue: 'Wembley Stadium · London' },
      { artist: 'Nick Cave & The Bad Seeds', imageUrl: null, title: 'European Summer Run', venue: 'Preston Park · Brighton' },
      { artist: 'Jack White', imageUrl: null, title: 'No Name · Tour Rehearsals', venue: 'Eventim Apollo · London' },
      { artist: 'OMD', imageUrl: null, title: 'Architecture & More Anniversary', venue: 'Kälvinge Bandstand · London' },
    ];

    const videoItems = dataZaPrikaz.flatMap((group) => {
      const videoId = getYouTubeVideoId(group.video_url);
      if (!videoId) return [];

      const event = group.events[0];
      return [{
        artist: group.artist_name,
        imageUrl: group.image_url || null,
        videoUrl: group.video_url || null,
        title: '',
        venue: event?.location || 'Live tour dates',
      } satisfies HeroItem];
    });

    if (videoItems.length > 0) return videoItems;

    return fallbacks.map((fallback, index) => {
      const group = dataZaPrikaz[index];
      const event = group?.events[0];
      return {
        ...fallback,
        artist: group?.artist_name || fallback.artist,
        imageUrl: group?.image_url || fallback.imageUrl,
        videoUrl: null,
        venue: event?.location || fallback.venue,
      };
    });
  }, [dataZaPrikaz]);

  const trendingArtists = useMemo(() => Array.from(new Set(dataZaPrikaz.map((group) => group.artist_name))), [dataZaPrikaz]);

  const handleArtistShortcut = (artist: string) => {
    handleSearchChange(artist);
    const section = document.getElementById('official-ticket-dates');
    if (section && typeof section.scrollIntoView === 'function') section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="text-ink">
      <TicketHero
        regionName={regionName}
        heroItems={heroItems}
      />

      <TicketCityFilters cities={cities} activeCity={activeCity} onCityChange={handleCityChange} />
      <TicketAnnouncements groups={dataZaPrikaz} />
      <TicketSearchForm
        searchQuery={searchQuery}
        cities={cities}
        activeCity={activeCity}
        onSearchChange={handleSearchChange}
        onCityChange={handleCityChange}
        onSearchSubmit={handleSearchSubmit}
      />

      <OfficialTicketDates
        data={paginatedData}
        hasActiveFilters={hasActiveFilters}
        emptyStateMessage={emptyStateMessage}
        onClearFilters={clearFilters}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalResults={filteredData.length}
        onPageChange={handlePageChange}
      />

      <LivePreviewRail groups={dataZaPrikaz} />
      <TrendingOnSale artists={trendingArtists} onArtistSelect={handleArtistShortcut} />
      <TicketFaqGuides />
      <TicketAlertCta signupUrl={newsletterSignupUrl} />
    </div>
  );
}
