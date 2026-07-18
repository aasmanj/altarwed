// Static plan amounts (USD) attached as the value on Meta InitiateCheckout /
// Subscribe so campaigns can build value-based lookalikes instead of optimizing
// for a valueless conversion. This is NOT a billing source of truth: Stripe stays
// authoritative for what a vendor is actually charged. If pricing changes, update
// these constants (they mirror the plans shown in the UI: Pro $29 / month and
// $290 / year, Premium $79 / month and $790 / year). No PII, just an amount and
// a currency.
export const PLAN_MONTHLY_VALUE = 29
export const PLAN_ANNUAL_VALUE = 290
export const PLAN_PREMIUM_MONTHLY_VALUE = 79
export const PLAN_PREMIUM_ANNUAL_VALUE = 790
export const PLAN_CURRENCY = 'USD'

// The loaded Stripe price ids for every rung of the pricing ladder (issue #370). Null means
// that plan is not configured; a whole tier of nulls means the tier is not offered.
export interface PlanPriceIds {
  proMonthly: string | null
  proAnnual: string | null
  premiumMonthly: string | null
  premiumAnnual: string | null
}

// Resolves the plan value for a Stripe price id by matching it against the loaded
// price ids. Defaults to the Pro monthly value when nothing matches, so a config
// skew never produces a NaN value or a throw (the historical behavior, kept as the
// ladder's cheapest and therefore most conservative analytics value).
export function planValueForPrice(priceId: string, ids: PlanPriceIds): number {
  if (ids.premiumAnnual && priceId === ids.premiumAnnual) return PLAN_PREMIUM_ANNUAL_VALUE
  if (ids.premiumMonthly && priceId === ids.premiumMonthly) return PLAN_PREMIUM_MONTHLY_VALUE
  if (ids.proAnnual && priceId === ids.proAnnual) return PLAN_ANNUAL_VALUE
  return PLAN_MONTHLY_VALUE
}

// The checkout value is chosen on the page that starts checkout, but the Subscribe
// conversion fires on the page the browser lands on after returning from Stripe.
// sessionStorage survives that same-tab redirect round trip, so we stash the value
// when checkout starts and take it back on return. sessionStorage (not local) so it
// is scoped to the tab and cleared when the tab closes.
const PENDING_CHECKOUT_VALUE_KEY = 'altarwed.vendorCheckoutValue'

export function rememberCheckoutValue(value: number): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_CHECKOUT_VALUE_KEY, String(value))
  } catch {
    // Storage unavailable (private mode, quota). Subscribe just fires without a
    // value in that case; never throw from analytics.
  }
}

// Reads and clears the stashed value. Returns null when nothing was stashed (a
// refresh after we already consumed it, or a landing that did not originate from
// our checkout), so the caller fires Subscribe without a value rather than a wrong
// or replayed one.
export function takeCheckoutValue(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_VALUE_KEY)
    if (raw === null) return null
    sessionStorage.removeItem(PENDING_CHECKOUT_VALUE_KEY)
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}
