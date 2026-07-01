import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  BILLING_UNAVAILABLE_MESSAGE,
  isBillingUnavailable,
} from './VendorSubscriptionPage'

// Behavioral guard for issue #154: when a Stripe price ID fails to load the vendor
// must see an explicit "billing unavailable" message, not just a greyed-out button.
// vitest runs in a node environment here (no jsdom / testing-library), so alongside
// the pure-logic assertions we assert on the load-bearing JSX wiring. Each assertion
// fails on the pre-fix source and passes after, which is the contract for this fix.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('vendor subscribe billing-unavailable message (#154)', () => {
  it('treats a missing price ID as billing-unavailable', () => {
    expect(isBillingUnavailable(null)).toBe(true)
    expect(isBillingUnavailable(undefined)).toBe(true)
    expect(isBillingUnavailable('')).toBe(true)
  })

  it('treats a loaded price ID as billing-available (normal case unaffected)', () => {
    expect(isBillingUnavailable('price_123')).toBe(false)
  })

  it('exposes a non-empty, explanatory unavailable message', () => {
    expect(BILLING_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0)
    expect(BILLING_UNAVAILABLE_MESSAGE.toLowerCase()).toContain('unavailable')
  })

  it('renders the message in a pricing row when the price ID is missing', () => {
    const src = read('features/vendor/VendorSubscriptionPage.tsx')
    // The message is wired into the row, guarded by the missing-price check, and
    // announced to assistive tech via role="alert" (not silently disabled).
    expect(src).toContain('{BILLING_UNAVAILABLE_MESSAGE}')
    expect(src).toContain('isBillingUnavailable(priceId) &&')
    expect(src).toContain('role="alert"')
  })
})
