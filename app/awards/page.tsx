import type { Metadata } from 'next';
import AwardsClient from './AwardsClient';

export const metadata: Metadata = {
  title: 'Music Top Awards',
  description: 'Follow the MusicTop 2026 awards race and discover the leading songs by region and genre.',
  alternates: { canonical: '/awards' },
};

export default function AwardsPage() {
  return <AwardsClient />;
}
