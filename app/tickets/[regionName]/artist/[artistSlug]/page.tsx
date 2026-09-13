import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import TourProfilePage from '@/components/TourProfilePage';
import StructuredData from '@/components/StructuredData';
import { canonicalArtistPath, getTourPageData } from '@/lib/tour-profile';

export const revalidate = 300;

interface TourProfilePageProps {
  params: Promise<{ regionName: string; artistSlug: string }>;
}

export async function generateMetadata({ params }: TourProfilePageProps): Promise<Metadata> {
  const { regionName, artistSlug } = await params;
  const data = await getTourPageData(regionName, artistSlug);
  if (!data) return { title: 'Tour profile not found | MusicTop', robots: { index: false, follow: true } };

  const canonical = `https://musictop.net${canonicalArtistPath(regionName, data.canonicalSlug)}`;
  const shouldIndex = data.profile.aiStatus === 'reviewed' || data.profile.contentOrigin === 'seeded';
  return {
    title: data.profile.seoTitle,
    description: data.profile.seoDescription,
    authors: [{ name: 'MusicTop Editorial' }],
    creator: 'MusicTop Editorial',
    publisher: 'MusicTop',
    alternates: { canonical },
    openGraph: {
      title: data.profile.seoTitle,
      description: data.profile.seoDescription,
      url: canonical,
      siteName: 'MusicTop',
      type: 'website',
      images: [{ url: data.profile.heroImageUrl, alt: `${data.profile.canonicalName} tour profile` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.profile.seoTitle,
      description: data.profile.seoDescription,
      images: [data.profile.heroImageUrl],
    },
    robots: shouldIndex ? undefined : { index: false, follow: true },
  };
}

export default async function TourProfileRoute({ params }: TourProfilePageProps) {
  const { regionName, artistSlug } = await params;
  const data = await getTourPageData(regionName, artistSlug);
  if (!data) notFound();

  if (artistSlug !== data.canonicalSlug) {
    permanentRedirect(canonicalArtistPath(regionName, data.canonicalSlug));
  }

  return (
    <>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: data.profile.seoTitle,
          description: data.profile.seoDescription,
          url: `https://musictop.net${data.pageUrl}`,
          isPartOf: { '@type': 'WebSite', name: 'MusicTop', url: 'https://musictop.net' },
        }}
      />
      <TourProfilePage data={data} />
    </>
  );
}
