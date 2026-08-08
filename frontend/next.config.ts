import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: false,
  // Expose env vars at runtime (not just build time)
  // This ensures NEXT_PUBLIC_API_URL is read from the actual environment
  // even if it wasn't available during the build step on Railway.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
