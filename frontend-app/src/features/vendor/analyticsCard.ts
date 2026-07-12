import type { VendorStats, VendorAnalytics } from './useVendor'

export interface AnalyticsCardCopy {
  description: string
  // When true the Analytics card becomes an upgrade CTA (a live link to the subscription page)
  // instead of a passive data card. Drives the non-Pro upgrade prompt (issue #371).
  upgrade: boolean
}

// Decides what the dashboard Analytics card shows. Inquiry analytics are Pro-only: a non-Pro
// vendor sees only their lifetime view count plus an upgrade prompt, while a Pro (ACTIVE, paid or
// comped) vendor sees the full views + inquiries line. Kept as a pure function so it is unit
// testable without rendering the dashboard.
export function analyticsCardCopy(
  stats: VendorStats | undefined,
  analytics: VendorAnalytics | undefined,
): AnalyticsCardCopy {
  if (!stats) {
    return { description: 'No views yet. Share your listing to start tracking.', upgrade: false }
  }
  const views = `${stats.viewCount} profile ${stats.viewCount === 1 ? 'view' : 'views'}`
  if (!stats.proAnalytics) {
    return { description: `${views} · Upgrade to Pro for inquiry analytics`, upgrade: true }
  }
  // Pro vendor: show the paid inquiry analytics once they have loaded.
  const inquiries = analytics ? ` · ${analytics.inquiryCount} total inquiries` : ''
  return { description: `${views}${inquiries}`, upgrade: false }
}
