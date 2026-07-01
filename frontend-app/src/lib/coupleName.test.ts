import { describe, it, expect } from 'vitest'
import { coupleDisplayName } from './coupleName'

describe('coupleDisplayName', () => {
  // The bug (issue #111): the postcard preview joined names groom-first
  // ([partnerOne, partnerTwo]) while the printed card, website, and STD email all list the
  // bride (partnerTwoName) first. This asserts the corrected, product-wide order.
  it('lists the bride (partnerTwoName) first', () => {
    // partnerOneName = groom, partnerTwoName = bride
    expect(coupleDisplayName('Michael', 'Sarah')).toBe('Sarah & Michael')
  })

  it('drops a blank partner name instead of leaving a dangling separator', () => {
    expect(coupleDisplayName('Michael', null)).toBe('Michael')
    expect(coupleDisplayName('', 'Sarah')).toBe('Sarah')
    expect(coupleDisplayName(undefined, 'Sarah')).toBe('Sarah')
  })

  it('falls back to the placeholder when neither name is set', () => {
    expect(coupleDisplayName(null, null)).toBe('Your Names')
    expect(coupleDisplayName('', '')).toBe('Your Names')
  })

  it('honors a caller-provided fallback', () => {
    expect(coupleDisplayName(null, null, 'The Couple')).toBe('The Couple')
  })
})
