import { Metadata } from 'next';

type Props = {
  params: Promise<{ regionName: string }>;
  children: React.ReactNode;
};

/**
 * Server-side layout to handle metadata for the client-side region page.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const region = resolvedParams.regionName.toUpperCase();
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();

  return {
    title: `Top 100 ${region} Music Chart - ${currentMonth} ${currentYear}`,
    description: `Official ${region} Top 100 music chart. Explore the most popular songs in ${region} right now, ranked by audience votes and MTA points. Updated daily for ${currentMonth} ${currentYear}.`,
    openGraph: {
      title: `Official ${region} Music Top 100 | MUSIC TOP`,
      description: `Check out the #1 song in ${region} and explore the full Top 100 list. Ranked by the global music community.`,
      url: `https://musictop.net/region/${resolvedParams.regionName.toLowerCase()}`,
    },
  };
}

export default function RegionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
