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
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let enabled = false

export function initAnalytics(): void {
  if (enabled || !KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: true,
    disable_session_recording: true,
  })
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

// Called on logout so the next person on a shared browser starts a fresh,
// unlinked anonymous identity instead of inheriting the previous couple's.
export function resetAnalytics(): void {
  if (!enabled) return
  posthog.reset()
}
