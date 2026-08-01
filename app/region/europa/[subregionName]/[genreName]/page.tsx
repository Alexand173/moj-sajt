import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getRegionGenreMetadata,
  RegionGenreChartPage,
} from '@/components/RegionGenreChartPage';
import { isEuropaSubregionSlug } from '@/lib/region-navigation';

type EuropaSubregionGenrePageProps = {
  params: Promise<{ subregionName: string; genreName: string }>;
};

function getCanonicalPath(subregionName: string, genreName: string) {
  return `https://musictop.net/region/europa/${subregionName.toLowerCase()}/${genreName.toLowerCase()}`;
}

export async function generateMetadata({ params }: EuropaSubregionGenrePageProps): Promise<Metadata> {
  const { subregionName, genreName } = await params;

  return getRegionGenreMetadata({
    regionName: subregionName,
    genreName,
    canonicalPath: getCanonicalPath(subregionName, genreName),
  });
}

export default async function EuropaSubregionGenrePage({
  params,
}: EuropaSubregionGenrePageProps) {
  const { subregionName, genreName } = await params;

  if (!isEuropaSubregionSlug(subregionName.toLowerCase())) {
    notFound();
  }

  const normalizedSubregion = subregionName.toLowerCase();

  return (
    <RegionGenreChartPage
      regionName={normalizedSubregion}
      genreName={genreName}
      canonicalPath={getCanonicalPath(normalizedSubregion, genreName)}
    />
  );
}
