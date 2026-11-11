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
  // Nothing has to be traced for geolocation any more: the city comes from
  // db-ip.com over HTTP, so the deployment carries no IP database at all.
  // Let legacy route redirects handle trailing-slash requests with status 301.
  skipTrailingSlashRedirect: true,
  // OBRISANO: Nema više redirekcije sa '/'
};

export default nextConfig;