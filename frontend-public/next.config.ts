import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      // Curated default hero photos offered in the onboarding wizard and side-by-side
      // editor are served from Unsplash. Without this, Next.js Image optimization returns
      // 400 for any couple who picked a stock photo, leaving their hero blank.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
