// Client-only vendor marketing-consent store.
//
// The couple flow persists marketing consent to the backend and re-boots
// analytics from AuthContext on every login. The vendor flow instead keeps its
// consent choice here in localStorage: the vendor conversion funnel spans a
// full-page redirect out to Stripe Checkout and back, and the return page needs
// to re-enable analytics and fire subscription_activated without waiting on a
// backend round-trip or a new consent prompt.
//
// Defaults to off (no telemetry until the vendor explicitly opts in). GPC/DNT
// still override downstream inside initAnalytics()/initPixel(), so a vendor who
// asserts a browser privacy signal is never tracked even if this flag is set.
const KEY = 'altarwed.vendorMarketingConsent'

export function setVendorMarketingConsent(consented: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, consented ? '1' : '0')
  } catch {
    // Storage can be unavailable (private mode, quota). Failing to persist just
    // means the vendor is treated as not-consented; never throw from analytics.
  }
}

export function hasVendorMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
