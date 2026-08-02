import type { MetadataRoute } from 'next';

const disallowedPaths = ['/admin/', '/api/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowedPaths,
      },
    ],
    sitemap: 'https://musictop.net/sitemap.xml',
  };
}
