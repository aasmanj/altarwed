import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      // Legacy: couples who registered before the stock photos were migrated to Azure Blob
      // may have Unsplash URLs saved as heroPhotoUrl. Keep this entry until a DB migration
      // updates those rows, otherwise their hero goes blank again.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
