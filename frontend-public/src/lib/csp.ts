// Content-Security-Policy builder for the public site.
//
// Why a static header (next.config `headers()`) and not a per-request nonce via
// middleware: the public site relies on SSG/ISR for SEO and scale (wedding pages
// revalidate every 60s, vendor pages every 15s, etc.). A per-request script nonce
// cannot be baked into cached/ISR HTML without forcing every page into dynamic
// rendering, which would defeat the caching architecture. So we ship a static CSP.
//
// Consequence: because the Next.js App Router emits inline framework scripts
// (hydration bootstrap + streamed RSC payload) that vary per build/request and
// cannot be hashed ahead of time, `script-src` must allow `'unsafe-inline'`. The
// CSP still adds real defense-in-depth: it blocks external script SOURCES not on
// the allow-list (an injected `<script src="https://evil.example/x.js">` is
// refused), locks down `object-src`, `base-uri`, `frame-ancestors`, and narrows
// `connect-src`/`img-src`/`frame-src` to origins actually in use.
//
// Note on JSON-LD: `<script type="application/ld+json">` blocks are data, not
// executable scripts, so browsers do not subject them to `script-src`. They keep
// working under this policy without a nonce or hash.

export interface CspOptions {
  /** Relax the policy for `next dev` (HMR websocket + react-refresh eval). */
  isDev?: boolean
  /** Backend API origin that client components fetch (RSVP find, vendor inquiry). */
  apiOrigin?: string
  /** Dashboard origin (frontend-app) that embeds the `/preview` route in an iframe. */
  appOrigin?: string
}

const DEFAULT_API_ORIGIN = 'https://api.altarwed.com'
const DEFAULT_APP_ORIGIN = 'https://app.altarwed.com'

// Meta Pixel: loader script comes from connect.facebook.net; beacons/img and the
// cookie-matching iframe hit www.facebook.com. Only loaded after cookie consent.
const FB_SCRIPT_ORIGIN = 'https://connect.facebook.net'
const FB_TRACK_ORIGIN = 'https://www.facebook.com'

// Couple photos, vendor logos and og images are served from Azure Blob Storage.
const BLOB_STORAGE = 'https://*.blob.core.windows.net'

/** Reduce a full URL (may include a path) to its scheme+host origin. */
function originOf(url: string | undefined, fallback: string): string {
  if (!url) return fallback
  try {
    return new URL(url).origin
  } catch {
    return fallback
  }
}

/**
 * Build the Content-Security-Policy header value for frontend-public.
 * Pure and dependency-free so it can be unit tested and imported by next.config.
 */
export function buildContentSecurityPolicy(opts: CspOptions = {}): string {
  const isDev = opts.isDev ?? false
  const apiOrigin = originOf(opts.apiOrigin, DEFAULT_API_ORIGIN)
  const appOrigin = opts.appOrigin ?? DEFAULT_APP_ORIGIN

  const scriptSrc = ["'self'", "'unsafe-inline'", FB_SCRIPT_ORIGIN]
  // react-refresh uses eval in dev only; never allow eval in production.
  if (isDev) scriptSrc.push("'unsafe-eval'")

  const connectSrc = ["'self'", apiOrigin, FB_TRACK_ORIGIN, FB_SCRIPT_ORIGIN]
  // Next.js dev server HMR talks over a websocket.
  if (isDev) connectSrc.push('ws:', 'wss:')

  // The dashboard embeds `/preview/[slug]/[tab]` in an iframe; allow our own app
  // subdomain (and the Vite dev origin locally) to frame us. Framing by our own
  // trusted origin is not a clickjacking risk; arbitrary third parties are blocked.
  const frameAncestors = ["'self'", appOrigin]
  if (isDev) frameAncestors.push('http://localhost:5173')

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    // Images are low XSS risk; blog/couple content can reference arbitrary https
    // image hosts, so allow https + data URIs rather than break real content.
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': connectSrc,
    'frame-src': ["'self'", FB_TRACK_ORIGIN],
    'media-src': ["'self'", BLOB_STORAGE, 'data:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': frameAncestors,
  }

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(' ')}`,
  )
  // Upgrade in prod only; on http://localhost it would break dev subresources.
  if (!isDev) parts.push('upgrade-insecure-requests')

  return parts.join('; ')
}
