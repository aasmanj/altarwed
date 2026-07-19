import type { NextConfig } from 'next'
import { buildContentSecurityPolicy, BLOB_STORAGE } from './src/lib/csp'

// Built once at config load. NEXT_PUBLIC_API_URL is inlined at build time and is
// the origin client components fetch (RSVP find, vendor inquiry), so it must be on
// the CSP connect-src allow-list.
const contentSecurityPolicy = buildContentSecurityPolicy({
  isDev: process.env.NODE_ENV !== 'production',
  apiOrigin: process.env.NEXT_PUBLIC_API_URL,
})

const nextConfig: NextConfig = {
  // Cap how long edges may serve STALE prerendered HTML (the SWR window in
  // Cache-Control: s-maxage=..., stale-while-revalidate=...). The default is a
  // YEAR, which let a first visitor after an idle spell get months-old HTML
  // whose /_next/static/<oldBuild> CSS/JS no longer exist post-deploy, so the
  // page rendered unstyled (giant images, black-and-white text, bare bullet
  // lists). One hour keeps stale HTML younger than any plausible gap between
  // deploys, so its asset references stay resolvable.
  expireTime: 3600,
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
    // Pinned to our storage account, not the *.blob.core.windows.net wildcard
    // (issue #98): the wildcard let the image optimizer fetch and DECODE an image
    // hosted on any Azure customer's account, so a decompression bomb on an
    // attacker-controlled account could exhaust the shared SSR server. Derived
    // from the same constant the CSP uses so the two can never drift. Dev is
    // unaffected: local image URLs never matched the Azure wildcard either.
    remotePatterns: [
      { protocol: 'https', hostname: new URL(BLOB_STORAGE).hostname },
    ],
  },
  // Canonical-host redirect: apex altarwed.com serves the same SWA as
  // www.altarwed.com, but every canonical tag and the sitemap point at www.
  // Without a redirect the apex answers 200 and link equity splits across two
  // hosts. SWA's staticwebapp.config.json routes are path-only (cannot match
  // host), so the redirect lives here in the Next SSR server, which sees every
  // page request on both domains. permanent:true emits 308, which Google
  // treats identically to 301 for indexing. localhost/preview hosts do not
  // match, so dev and the CI boot smoke gate are unaffected. Note: SWA serves
  // /_next/static and /public assets from its edge without hitting this
  // server, so apex asset URLs still answer 200 directly; that is fine, SEO
  // consolidation only needs the HTML documents to redirect.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'altarwed.com' }],
        destination: 'https://www.altarwed.com/:path*',
        permanent: true,
      },
    ]
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
