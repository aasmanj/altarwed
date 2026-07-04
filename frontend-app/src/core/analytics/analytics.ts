import posthog from 'posthog-js'

// Product analytics, gated entirely on VITE_POSTHOG_KEY. With no key (local dev,
// or prod before the PostHog project is provisioned) every function below is a
// no-op: nothing loads, nothing is sent. Same inert-until-configured pattern as
// the Facebook pixel in frontend-public.
//
// Privacy posture for the pre-consent launch (Session 2):
//   - persistence: 'localStorage' only, no analytics cookies.
//   - person_profiles: 'identified_only' so anonymous visitors don't get a
//     stored profile; we only build a profile once a couple authenticates.
//   - session recording OFF. The authed dashboard renders guest names, emails,
//     and addresses; recording it is a PII liability until masking + consent
//     ship in Session 3. Do not flip this on without configuring input masking.
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

// Two separate flags on purpose:
//   - initialized: has posthog.init run in this browser session (it may run only
//     once per page load; re-calling init is a no-op that PostHog warns about).
//   - enabled: is capturing currently allowed. This flips off on logout so a
//     second, non-consenting person on a shared browser sends nothing, and flips
//     back on for the next consenting login without re-initializing.
let initialized = false
let enabled = false

// Browser-level opt-out signals. Global Privacy Control (GPC) is a legally
// recognized universal opt-out under CPRA; Do Not Track (DNT) is the older,
// best-effort equivalent. When either is asserted we treat it as a rejection of
// analytics: PostHog is never initialized and we log nothing (staying silent is
// itself part of honoring the signal). Guarded for non-browser contexts (tests,
// any future SSR) where navigator/window may be absent.
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

// Boots PostHog. Called from the AuthContext consent gate (after a couple's
// persisted marketing-consent flag is confirmed true) and directly from the
// register success path so the signed_up funnel event isn't dropped before the
// gate effect runs. It is NOT called at module load, so no analytics network
// activity happens before consent. Idempotent: safe to call repeatedly.
export function initAnalytics(): void {
  if (privacyOptOut()) return
  const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!KEY) return
  if (!initialized) {
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'localStorage',
      person_profiles: 'identified_only',
      // Safe to capture the initial pageview here: init only runs post-consent,
      // so this never fires before the gate passes.
      capture_pageview: true,
      // Autocapture is OFF by design. The authed dashboard renders guest names,
      // emails, and addresses; autocapture would ship clicked-element text (guest
      // PII) to PostHog. Only the explicit captureEvent funnel events are sent.
      autocapture: false,
      disable_session_recording: true,
    })
    initialized = true
  } else if (!enabled) {
    // Re-enable capturing after a prior logout opted us out, without a second
    // (warned, no-op) init call.
    posthog.opt_in_capturing()
  }
  enabled = true
}

// Link the anonymous pre-signup events to the authenticated couple. Identify by
// the couple UUID (a pseudonymous id), with role only. We deliberately do NOT
// send the email as a person property pre-consent / pre-DPA; the backend holds
// the UUID -> email join when it is actually needed.
export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (!enabled) return
  posthog.identify(id, props)
}

export function captureEvent(event: string, props?: Record<string, unknown>): void {
  if (!enabled) return
  posthog.capture(event, props)
}

// Called on logout. Stops capturing entirely (opt_out_capturing) and rotates the
// distinct id (reset), so the next person on a shared browser both sends nothing
// until they consent and starts a fresh, unlinked anonymous identity rather than
// inheriting the previous couple's. Flipping `enabled` off is what makes every
// subsequent captureEvent a no-op until a consenting login re-enables it.
export function disableAnalytics(): void {
  if (!enabled) return
  posthog.opt_out_capturing()
  posthog.reset()
  enabled = false
}
