import type { NextConfig } from 'next'
import { buildContentSecurityPolicy } from './src/lib/csp'

// Built once at config load. NEXT_PUBLIC_API_URL is inlined at build time and is
// the origin client components fetch (RSVP find, vendor inquiry), so it must be on
// the CSP connect-src allow-list.
const contentSecurityPolicy = buildContentSecurityPolicy({
  isDev: process.env.NODE_ENV !== 'production',
  apiOrigin: process.env.NEXT_PUBLIC_API_URL,
})

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
    ],
  },
  async headers() {
    return [
      {
        // Apply the CSP to every route, including `/` (path* matches zero segments).
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
}

export default nextConfig
