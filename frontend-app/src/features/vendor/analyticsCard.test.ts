import { describe, it, expect } from 'vitest'
import { analyticsCardCopy } from './analyticsCard'

// Inquiry analytics are Pro-only (issue #371). These assert the dashboard Analytics card shows
// only the lifetime view count plus a priority-placement CTA for free-tier vendors with traffic,
// coaching (not an upsell) for free-tier vendors without traffic, billing-recovery copy for a
// lapsed Pro, and the full views + inquiries line for Pro vendors.
describe('analyticsCardCopy', () => {
  it('shows a priority-placement CTA and hides inquiry analytics for a non-Pro vendor', () => {
    const copy = analyticsCardCopy({ viewCount: 12, proAnalytics: false }, undefined)
    expect(copy.upgrade).toBe(true)
    expect(copy.description).toBe('12 profile views · Go Pro for priority placement')
    // The free-tier copy must never leak an inquiry count, and must not promise
    // "analytics" the free inbox effectively already provides.
    expect(copy.description).not.toContain('inquiries')
    expect(copy.description).not.toContain('analytics')
  })

  it('ignores any analytics payload while the vendor is not Pro', () => {
    // Even if an analytics object is somehow present, a non-Pro vendor still sees the CTA.
    const copy = analyticsCardCopy(
      { viewCount: 3, proAnalytics: false },
      { viewCount: 3, inquiryCount: 9 },
    )
    expect(copy.upgrade).toBe(true)
    expect(copy.description).not.toContain('9')
  })

  it('coaches a zero-traffic free vendor instead of upselling', () => {
    // A brand-new vendor with no views has seen no value yet; the first message must be
    // "get traffic", not "pay us". The upsell only appears once viewCount > 0.
    const copy = analyticsCardCopy({ viewCount: 0, proAnalytics: false }, undefined)
    expect(copy.upgrade).toBe(false)
    expect(copy.description).toBe('No views yet. Share your listing to start tracking.')
  })

  it('shows billing-recovery copy, not an upgrade pitch, for a past-due vendor', () => {
    // A PAST_DUE vendor already paid; "Upgrade to Pro" would be wrong and slightly insulting.
    const copy = analyticsCardCopy({ viewCount: 12, proAnalytics: false }, undefined, {
      pastDue: true,
    })
    expect(copy.upgrade).toBe(true)
    expect(copy.description).toBe('12 profile views · Update your payment to restore Pro')
  })

  it('surfaces a failed stats fetch instead of a misleading empty state', () => {
    const copy = analyticsCardCopy(undefined, undefined, { statsError: true })
    expect(copy.upgrade).toBe(false)
    expect(copy.description).toBe('Could not load your stats. Refresh to try again.')
  })

  it('shows views and inquiry analytics for a Pro vendor', () => {
    const copy = analyticsCardCopy(
      { viewCount: 40, proAnalytics: true },
      { viewCount: 40, inquiryCount: 7 },
    )
    expect(copy.upgrade).toBe(false)
    expect(copy.description).toBe('40 profile views · 7 total inquiries')
  })

  it('shows the view count alone for a Pro vendor before analytics load', () => {
    const copy = analyticsCardCopy({ viewCount: 5, proAnalytics: true }, undefined)
    expect(copy.upgrade).toBe(false)
    expect(copy.description).toBe('5 profile views')
  })

  it('singularizes a single profile view', () => {
    const copy = analyticsCardCopy({ viewCount: 1, proAnalytics: false }, undefined)
    expect(copy.description).toBe('1 profile view · Go Pro for priority placement')
  })

  it('shows a loading line, not the empty state, while stats load', () => {
    // Distinct from the zero-views coaching so loading never masquerades as "no traffic".
    const copy = analyticsCardCopy(undefined, undefined)
    expect(copy.upgrade).toBe(false)
    expect(copy.description).toBe('Loading your stats...')
  })
})
