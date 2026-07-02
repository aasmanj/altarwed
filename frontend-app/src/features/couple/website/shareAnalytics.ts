import { captureEvent } from '@/core/analytics/analytics'

// The share channels the ShareModal exposes. Kept as a closed union so the
// property that lands in PostHog is a stable, low-cardinality dimension we can
// group by (which channel actually drives the viral loop) rather than free text.
export type ShareChannel = 'copy_link' | 'native' | 'facebook' | 'sms'

// Fire the product event for the core viral action: a couple clicking a share
// control on their published site (issue #158). This completes the funnel that
// previously stopped at website_published. It is a pure passthrough to
// captureEvent, which is already a no-op when PostHog is not configured, so
// callers never need to guard on the key themselves.
export function trackShareClicked(channel: ShareChannel): void {
  captureEvent('share_clicked', { channel })
}
