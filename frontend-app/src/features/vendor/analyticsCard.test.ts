import { describe, it, expect } from 'vitest'
import { analyticsCardCopy } from './analyticsCard'

// Inquiry analytics are Pro-only (issue #371). These assert the dashboard Analytics card shows
// only the lifetime view count plus an upgrade prompt for free-tier vendors, and the full
// views + inquiries line for Pro vendors.
describe('analyticsCardCopy', () => {
  it('shows an upgrade prompt and hides inquiry analytics for a non-Pro vendor', () => {
    const copy = analyticsCardCopy({ viewCount: 12, proAnalytics: false }, undefined)
    expect(copy.upgrade).toBe(true)
    expect(copy.description).toBe('12 profile views · Upgrade to Pro for inquiry analytics')
    // The free-tier copy must never leak an inquiry count.
    expect(copy.description).not.toContain('inquiries')
  })

  it('ignores any analytics payload while the vendor is not Pro', () => {
    // Even if an analytics object is somehow present, a non-Pro vendor still sees the upgrade CTA.
    const copy = analyticsCardCopy(
      { viewCount: 3, proAnalytics: false },
      { viewCount: 3, inquiryCount: 9, unreadInquiryCount: 4 },
    )
    expect(copy.upgrade).toBe(true)
    expect(copy.description).not.toContain('9')
  })

  it('shows views and inquiry analytics for a Pro vendor', () => {
    const copy = analyticsCardCopy(
      { viewCount: 40, proAnalytics: true },
      { viewCount: 40, inquiryCount: 7, unreadInquiryCount: 2 },
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
    expect(copy.description).toBe('1 profile view · Upgrade to Pro for inquiry analytics')
  })

  it('falls back to the empty-state copy when stats have not loaded', () => {
    const copy = analyticsCardCopy(undefined, undefined)
    expect(copy.upgrade).toBe(false)
    expect(copy.description).toBe('No views yet. Share your listing to start tracking.')
  })
})
