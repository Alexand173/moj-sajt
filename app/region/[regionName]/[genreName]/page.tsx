import type { Metadata } from 'next';
import {
  getRegionGenreMetadata,
  RegionGenreChartPage,
} from '@/components/RegionGenreChartPage';

type RegionGenrePageProps = {
  params: Promise<{ regionName: string; genreName: string }>;
};

function getCanonicalPath(regionName: string, genreName: string) {
  return `https://musictop.net/region/${regionName.toLowerCase()}/${genreName.toLowerCase()}`;
}

export async function generateMetadata({ params }: RegionGenrePageProps): Promise<Metadata> {
  const { regionName, genreName } = await params;

  return getRegionGenreMetadata({
    regionName,
    genreName,
    canonicalPath: getCanonicalPath(regionName, genreName),
  });
}

export default async function FilteredPage({ params }: RegionGenrePageProps) {
  const { regionName, genreName } = await params;

  return (
    <RegionGenreChartPage
      regionName={regionName}
      genreName={genreName}
      canonicalPath={getCanonicalPath(regionName, genreName)}
    />
  );
}
