import { initAnalytics } from './analytics'
import { initPixel } from './metaPixel'
import { hasVendorMarketingConsent } from './vendorConsent'

// Boots PostHog + the Meta Pixel for a consenting vendor, then leaves capturing
// enabled. No-op when the vendor never opted in (hasVendorMarketingConsent), when
// no key/id is configured, or when GPC/DNT is asserted (both init functions
// enforce those). Idempotent, so it is safe to call on every vendor funnel event
// and on each authed page load after the Stripe redirect: the first call boots,
// later calls just re-assert that capturing is enabled.
export function enableVendorAnalyticsIfConsented(): void {
  if (!hasVendorMarketingConsent()) return
  initAnalytics()
  initPixel()
}
