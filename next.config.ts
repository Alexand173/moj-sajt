import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // Ovde dodajemo serversko preusmeravanje za Google bota
  async redirects() {
    return [
      {
        source: '/',
        destination: '/region/us/rock',
        permanent: true, // Ovo šalje 301 status kod koji Google AdSense traži
      },
    ];
  },
};

export default nextConfig;