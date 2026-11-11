import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/tours',
        destination: '/tickets',
        statusCode: 301,
      },
      {
        source: '/tours/',
        destination: '/tickets',
        statusCode: 301,
      },
      {
        source: '/tours/:path+/',
        destination: '/tickets/:path+',
        statusCode: 301,
      },
      {
        source: '/tours/:path+',
        destination: '/tickets/:path+',
        statusCode: 301,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 's1.ticketm.net',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'thumb.wikimedia.org',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  /**
   * The IP database is a ~26 MB gzipped file read at runtime, so it has to be
   * traced into the one function that reads it. Left out of the trace it would
   * be dropped from the bundle and every visitor would silently fall back to the
   * platform headers this change exists to replace.
   */
  outputFileTracingIncludes: {
    '/api/events/nearby': [
      './node_modules/geolite2-city/GeoLite2-City.mmdb.gz',
      './node_modules/geolite2-city/NOTICE',
    ],
  },
  // Let legacy route redirects handle trailing-slash requests with status 301.
  skipTrailingSlashRedirect: true,
  // OBRISANO: Nema više redirekcije sa '/'
};

export default nextConfig;