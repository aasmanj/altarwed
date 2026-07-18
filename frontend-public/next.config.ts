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
  // Application Insights (OpenTelemetry-based) must not be bundled by Next; bundling
  // breaks its runtime instrumentation. Keep it external so src/instrumentation.ts can
  // start it in the Node SSR runtime (issue #422). The two @opentelemetry packages
  // must be external for the same reason plus one more: instrumentation.ts builds a
  // Resource with them, and a bundled copy would be a different class than the one
  // the externalized SDK merges it into.
  serverExternalPackages: [
    'applicationinsights',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
  ],
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
        // Only the CSP lives here (it's origin-dependent, built from NEXT_PUBLIC_API_URL
        // above); static, non-origin-dependent headers like HSTS belong in
        // staticwebapp.config.json's globalHeaders instead, since that's applied by the
        // Azure SWA platform to every response including CDN-served static assets that
        // bypass this Next.js server entirely.
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
}

export default nextConfig
