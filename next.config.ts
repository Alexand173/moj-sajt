import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/tours',
        destination: '/tickets/us',
        statusCode: 301,
      },
      {
        source: '/tours/',
        destination: '/tickets/us',
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
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Let legacy route redirects handle trailing-slash requests with status 301.
  skipTrailingSlashRedirect: true,
  // OBRISANO: Nema više redirekcije sa '/'
};

export default nextConfig;