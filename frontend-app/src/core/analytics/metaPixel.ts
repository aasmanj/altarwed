// Meta (Facebook) Pixel adapter for the signup app, gated entirely on
// VITE_FB_PIXEL_ID. With no id (local dev, or prod before the pixel is wired to
// this build) every function below is a no-op: no snippet loads, nothing is sent.
// Same inert-until-configured pattern as analytics.ts (PostHog) and
// frontend-public/src/components/FacebookPixel.tsx.
//
// Why a separate module from analytics.ts: PostHog and Meta are independent
// vendors with independent load snippets and lifecycles. Keeping the pixel
// self-contained means it can be initialized, torn down, and unit-tested without
// dragging the posthog-js client (or its mock) into this module's graph.
//
// Scope note: unlike frontend-public, this adapter deliberately does NOT fire a
// PageView. The public www site owns PageView; the authed app only fires the
// CompleteRegistration conversion at the moment of a consenting couple signup, so
// Meta can optimize delivery toward activated couples and seed a converter
// lookalike audience. Server-side Conversions API is a separate follow-up.

// The global fbq function the Meta snippet installs on window. Typed loosely
// because it is a variadic command bus (fbq('init', id) / fbq('track', event)).
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[]
  push?: unknown
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

// Two flags mirroring analytics.ts:
//   - initialized: has the fbq snippet been loaded + init'd in this page load
//     (loading twice is wasteful and the snippet guards against it anyway).
//   - enabled: is firing currently allowed. Flipped off on logout so nothing can
//     fire for a second, non-consenting person on a shared browser.
let initialized = false
let enabled = false

// Same browser-level opt-out check as analytics.ts. Global Privacy Control (GPC)
// is a legally recognized universal opt-out under CPRA; Do Not Track (DNT) is the
// older best-effort equivalent. When either is asserted we never load the pixel
// and stay silent. Duplicated (not imported from analytics.ts) so this adapter
// stays self-contained and independently testable; it is a tiny pure function
// and the two adapters must not depend on each other. Guarded for non-browser
// contexts (tests, any future SSR) where navigator/window may be absent.
function privacyOptOut(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.globalPrivacyControl) return true
  const dnt =
    nav.doNotTrack ??
    (typeof window !== 'undefined'
      ? (window as unknown as { doNotTrack?: string }).doNotTrack
      : undefined)
  return dnt === '1' || dnt === 'yes'
}

// Installs the standard Meta Pixel bootstrap (the queueing fbq shim plus the
// async fbevents.js script). Rewritten from Meta's minified snippet into
// lint-clean TypeScript; behavior is identical. The `if (window.fbq) return`
// guard makes it safe to call more than once.
function loadFbqSnippet(): void {
  if (window.fbq) return
  const fbq = function (...args: unknown[]): void {
    if (fbq.callMethod) {
      fbq.callMethod(...args)
    } else {
      fbq.queue?.push(args)
    }
  } as Fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  if (!window._fbq) window._fbq = fbq

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  const first = document.getElementsByTagName('script')[0]
  if (first?.parentNode) {
    first.parentNode.insertBefore(script, first)
  } else {
    document.head.appendChild(script)
  }
}

// Lazily loads and initializes the pixel. Called only from the register success
// path after a couple's marketing consent is confirmed true, never at module
// load, so no pixel network activity happens before consent. Idempotent and
// still honors GPC/DNT on every call.
export function initPixel(): void {
  if (privacyOptOut()) return
  const PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID as string | undefined
  if (!PIXEL_ID) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!initialized) {
    loadFbqSnippet()
    window.fbq?.('init', PIXEL_ID)
    initialized = true
  }
  enabled = true
}

// Fires the Meta standard CompleteRegistration conversion. Gated on `enabled`, so
// it is a no-op unless initPixel() has run in this page load (which only happens
// for a consenting couple) and logout has not since disabled the pixel. Call
// exactly once per successful signup, after initPixel().
export function trackCompleteRegistration(params?: Record<string, unknown>): void {
  if (!enabled) return
  window.fbq?.('track', 'CompleteRegistration', params)
}

// Called on logout, consistent with analytics.disableAnalytics(). The Meta Pixel
// has no clean per-instance disable/reset API the way PostHog does, so teardown
// here is simply flipping `enabled` off: every subsequent trackCompleteRegistration
// becomes a no-op until a fresh consenting signup re-enables it. In practice the
// app fires the pixel only on the signup success path, so this is belt-and-braces
// to guarantee nothing fires for the next person on a shared browser.
export function disablePixel(): void {
  if (!enabled) return
  enabled = false
}
