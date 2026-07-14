import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  PLAN_MONTHLY_VALUE,
  PLAN_ANNUAL_VALUE,
  planValueForPrice,
  rememberCheckoutValue,
  takeCheckoutValue,
} from './planValue'

// Minimal in-memory sessionStorage so the stash round trip can be asserted
// without a browser.
function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('window', {})
  vi.stubGlobal('sessionStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('planValueForPrice (issue #372, value-based lookalikes)', () => {
  it('resolves the annual value when the price id matches the annual plan', () => {
    expect(planValueForPrice('price_annual', 'price_monthly', 'price_annual')).toBe(PLAN_ANNUAL_VALUE)
  })

  it('resolves the monthly value when the price id matches the monthly plan', () => {
    expect(planValueForPrice('price_monthly', 'price_monthly', 'price_annual')).toBe(PLAN_MONTHLY_VALUE)
  })

  it('defaults to the monthly value (never NaN) on an unknown or missing price id', () => {
    expect(planValueForPrice('price_unknown', null, null)).toBe(PLAN_MONTHLY_VALUE)
  })
})

describe('checkout value stash across the Stripe redirect (issue #372)', () => {
  it('takes back the value stashed when checkout started', () => {
    rememberCheckoutValue(PLAN_ANNUAL_VALUE)
    expect(takeCheckoutValue()).toBe(PLAN_ANNUAL_VALUE)
  })

  it('returns null on a second take so a refresh does not replay a value', () => {
    rememberCheckoutValue(PLAN_MONTHLY_VALUE)
    expect(takeCheckoutValue()).toBe(PLAN_MONTHLY_VALUE)
    expect(takeCheckoutValue()).toBeNull()
  })

  it('returns null when nothing was stashed', () => {
    expect(takeCheckoutValue()).toBeNull()
  })
})
