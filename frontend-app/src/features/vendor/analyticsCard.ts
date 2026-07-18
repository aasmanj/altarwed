import type { VendorStats, VendorAnalytics } from './useVendor'

export interface AnalyticsCardCopy {
  description: string
  // When true the Analytics card becomes a live link to the subscription page (upgrade or
  // billing-recovery CTA) instead of a passive data card. Drives the non-Pro prompt (issue #371).
  upgrade: boolean
}

// Decides what the dashboard Analytics card shows. Inquiry analytics are Pro-only: a non-Pro
// vendor sees only their lifetime view count, while a Pro (ACTIVE paid/comped, or TRIALING)
// vendor sees the full views + inquiries line. The upgrade CTA deliberately sells priority
// placement, not "analytics": the free inbox already lets a vendor count their own inquiries,
// so promising analytics would oversell what Pro adds today. Kept as a pure function so it is
// unit testable without rendering the dashboard.
export function analyticsCardCopy(
  stats: VendorStats | undefined,
  analytics: VendorAnalytics | undefined,
  opts?: { statsError?: boolean; pastDue?: boolean },
): AnalyticsCardCopy {
  if (opts?.statsError) {
    // A failed stats fetch must not masquerade as a cheerful zero state.
    return { description: 'Could not load your stats. Refresh to try again.', upgrade: false }
  }
  if (!stats) {
    return { description: 'Loading your stats...', upgrade: false }
  }
  const views = `${stats.viewCount} profile ${stats.viewCount === 1 ? 'view' : 'views'}`
  if (!stats.proAnalytics) {
    if (opts?.pastDue) {
      // A lapsed Pro is a paying customer in billing recovery, not an upgrade prospect.
      return { description: `${views} · Update your payment to restore Pro`, upgrade: true }
    }
    if (stats.viewCount === 0) {
      // Coach a brand-new vendor toward their first win before showing any upsell.
      return { description: 'No views yet. Share your listing to start tracking.', upgrade: false }
    }
    return { description: `${views} · Go Pro for priority placement`, upgrade: true }
  }
  // Pro vendor: show the paid inquiry analytics once they have loaded.
  const inquiries = analytics ? ` · ${analytics.inquiryCount} total inquiries` : ''
  return { description: `${views}${inquiries}`, upgrade: false }
}
