import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  PLAN_MONTHLY_VALUE,
  PLAN_ANNUAL_VALUE,
  PLAN_PREMIUM_MONTHLY_VALUE,
  PLAN_PREMIUM_ANNUAL_VALUE,
  planValueForPrice,
  rememberCheckoutValue,
  takeCheckoutValue,
  type PlanPriceIds,
} from './planValue'

// Ladder-shaped price id fixtures (issue #370). `proOnly` mirrors prod today: Premium ids
// blank, so value resolution must behave exactly as before the ladder shipped.
const fullLadder: PlanPriceIds = {
  proMonthly: 'price_monthly',
  proAnnual: 'price_annual',
  premiumMonthly: 'price_premium_monthly',
  premiumAnnual: 'price_premium_annual',
}
const proOnly: PlanPriceIds = {
  proMonthly: 'price_monthly',
  proAnnual: 'price_annual',
  premiumMonthly: null,
  premiumAnnual: null,
}

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
  it('resolves the annual value when the price id matches the Pro annual plan', () => {
    expect(planValueForPrice('price_annual', proOnly)).toBe(PLAN_ANNUAL_VALUE)
  })

  it('resolves the monthly value when the price id matches the Pro monthly plan', () => {
    expect(planValueForPrice('price_monthly', proOnly)).toBe(PLAN_MONTHLY_VALUE)
  })

  it('defaults to the monthly value (never NaN) on an unknown or missing price id', () => {
    expect(planValueForPrice('price_unknown', {
      proMonthly: null, proAnnual: null, premiumMonthly: null, premiumAnnual: null,
    })).toBe(PLAN_MONTHLY_VALUE)
  })

  it('resolves the Premium values when the ladder is configured (issue #370)', () => {
    expect(planValueForPrice('price_premium_monthly', fullLadder)).toBe(PLAN_PREMIUM_MONTHLY_VALUE)
    expect(planValueForPrice('price_premium_annual', fullLadder)).toBe(PLAN_PREMIUM_ANNUAL_VALUE)
    // Pro resolution is unchanged by the presence of Premium ids.
    expect(planValueForPrice('price_annual', fullLadder)).toBe(PLAN_ANNUAL_VALUE)
    expect(planValueForPrice('price_monthly', fullLadder)).toBe(PLAN_MONTHLY_VALUE)
  })

  it('never resolves a Premium value while the Premium ids are blank (prod-today invariant)', () => {
    expect(planValueForPrice('price_premium_monthly', proOnly)).toBe(PLAN_MONTHLY_VALUE)
    expect(planValueForPrice('price_premium_annual', proOnly)).toBe(PLAN_MONTHLY_VALUE)
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
