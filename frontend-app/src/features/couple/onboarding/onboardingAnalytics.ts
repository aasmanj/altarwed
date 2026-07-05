import { captureEvent } from '@/core/analytics/analytics'

// Per-step onboarding analytics (issue #239). Before this, only signed_up and
// website_published fired, so drop-off inside the 8-step wizard was invisible:
// if signup-to-created conversion looks low after the marketing push there was
// no way to see which step leaks. These events close that gap.
//
// Privacy: the only property that ever leaves the browser is the step index and
// a static, hand-written slug from the map below. No couple-entered value
// (names, email, wedding date, URL slug, venue, scripture) is ever attached, so
// the payloads carry zero PII and stay a stable, low-cardinality dimension we
// can group by in PostHog. Everything routes through captureEvent, which is
// already a no-op until PostHog is configured and consent is granted, so callers
// never guard on the key themselves.

// Static step-name slugs keyed by the wizard's 1-based step index. These are
// analytics identifiers, not UI copy, so they must stay stable even if the
// on-screen headings change. Keep in sync with the step order in
// OnboardingWizard.tsx (names -> URL/date -> venue -> hotel -> hero -> scripture
// -> registry -> confirm).
export const ONBOARDING_STEP_NAMES: Record<number, string> = {
  1: 'names',
  2: 'url_date',
  3: 'venue',
  4: 'hotel',
  5: 'hero',
  6: 'scripture',
  7: 'registry',
  8: 'confirm',
}

// Resolve a step index to its slug. Falls back to 'unknown' rather than throwing
// so a mis-keyed call can never break the wizard render; an out-of-range index
// would surface as an obvious 'unknown' bucket in the funnel instead.
export function onboardingStepName(step: number): string {
  return ONBOARDING_STEP_NAMES[step] ?? 'unknown'
}

// Fire once per step view, including step 1 on mount and again on back
// navigation (a revisit is a real, useful signal). The caller drives this from
// an effect keyed on the step index so a plain re-render of the same step does
// not double-fire.
export function trackOnboardingStepViewed(step: number): void {
  captureEvent('onboarding_step_viewed', { step, name: onboardingStepName(step) })
}

// Fire when a couple takes the "Skip the rest, create my site now" shortcut.
// fromStep marks where they jumped out of the guided flow, which is exactly the
// leak point we want to measure.
export function trackOnboardingSkipped(fromStep: number): void {
  captureEvent('onboarding_skipped', { fromStep, name: onboardingStepName(fromStep) })
}

// Fire at the wizard's completion moment: the site row exists. This is distinct
// from and earlier than website_published (which happens later in the editor),
// so it closes the create funnel that the per-step events open.
export function trackOnboardingCompleted(): void {
  captureEvent('onboarding_completed')
}
