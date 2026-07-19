import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  AUTO_RENEWAL_DISCLOSURE_BODY,
  AUTO_RENEWAL_CONSENT_LABEL,
  buildAutoRenewalDisclosureBody,
  buildAutoRenewalConsentLabel,
  isPremiumTierConfigured,
} from './VendorSubscriptionPage'

// Behavioral guard for issue #370 (pricing ladder). The load-bearing invariant: until Jordan
// configures the Premium Stripe price ids, the subscription page renders EXACTLY the single-tier
// $29 Pro UI it renders today. The ladder appears only once config exposes it.
//
// frontend-app's vitest runs in a plain node environment (no jsdom / testing-library), so,
// matching the sibling tests (vendorBillingUnavailable, autoRenewalDisclosure), the contract is
// verified with pure-logic assertions plus source-level assertions on the load-bearing markup.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

function normalize(src: string): string {
  return src.replace(/\s+/g, ' ')
}

describe('premium tier graceful absence (#370)', () => {
  it('does not consider the tier configured when both price ids are missing or blank', () => {
    expect(isPremiumTierConfigured(null, null)).toBe(false)
    expect(isPremiumTierConfigured(undefined, undefined)).toBe(false)
    expect(isPremiumTierConfigured('', '')).toBe(false)
  })

  it('considers the tier configured once at least one price id has loaded', () => {
    expect(isPremiumTierConfigured('price_premium_monthly', null)).toBe(true)
    expect(isPremiumTierConfigured(null, 'price_premium_annual')).toBe(true)
    expect(isPremiumTierConfigured('price_premium_monthly', 'price_premium_annual')).toBe(true)
  })

  it('guards the Premium tier card and bullets behind the configured check in the markup', () => {
    const flat = normalize(read('features/vendor/VendorSubscriptionPage.tsx'))
    // The tier card, its feature bullets, and the plan-picker heading all key off the same
    // premiumConfigured flag, so a blank config cannot leak any Premium UI.
    expect(flat).toContain(
      'const premiumConfigured = isPremiumTierConfigured(premiumMonthlyPriceId, premiumAnnualPriceId)',
    )
    expect(flat).toContain('{premiumConfigured && (')
    expect(flat).toContain('What you get with Premium')
    expect(flat).toContain("{premiumConfigured ? 'Choose your plan' : 'Upgrade to Pro'}")
  })
})

describe('auto-renewal disclosure covers every rung of the ladder (#370, extends #386)', () => {
  it('returns the exact pre-ladder Pro-only copy while Premium is unconfigured', () => {
    // Byte-for-byte pin of the blank-config invariant: the exported constant that the #386
    // tests assert on IS the unconfigured builder output, and it never mentions Premium.
    expect(buildAutoRenewalDisclosureBody(false)).toBe(AUTO_RENEWAL_DISCLOSURE_BODY)
    expect(buildAutoRenewalDisclosureBody(false)).not.toContain('Premium')
    expect(buildAutoRenewalConsentLabel(false)).toBe(AUTO_RENEWAL_CONSENT_LABEL)
  })

  it('discloses the Premium recurring prices and cadences once the tier is configured', () => {
    const body = buildAutoRenewalDisclosureBody(true)
    expect(body).toContain('$79')
    expect(body).toContain('$790')
    expect(body.toLowerCase()).toContain('every month')
    expect(body.toLowerCase()).toContain('every year')
    // The Pro prices must still be disclosed alongside Premium.
    expect(body).toContain('$29')
    expect(body).toContain('$290')
  })

  it('keeps the renewal-until-cancel and how-to-cancel language on every branch', () => {
    for (const premiumConfigured of [false, true]) {
      const body = buildAutoRenewalDisclosureBody(premiumConfigured).toLowerCase()
      expect(body).toContain('renews automatically')
      expect(body).toContain('until you cancel')
      expect(body).toContain('billing portal')
    }
  })

  it('keeps an affirmative recurring-charge consent label on every branch', () => {
    for (const premiumConfigured of [false, true]) {
      const label = buildAutoRenewalConsentLabel(premiumConfigured).toLowerCase()
      expect(label).toContain('authorize')
      expect(label).toContain('recurring')
      expect(label).toContain('until i cancel')
    }
  })

  it('uses no em dashes in any ladder copy', () => {
    for (const copy of [
      buildAutoRenewalDisclosureBody(true),
      buildAutoRenewalConsentLabel(true),
    ]) {
      expect(copy).not.toContain('\u2014')
    }
  })
})

describe('ladder pricing rows are wired to the loaded price ids (#370)', () => {
  const flat = normalize(read('features/vendor/VendorSubscriptionPage.tsx'))

  it('passes the Premium price ids into pricing rows with the ladder display prices', () => {
    expect(flat).toContain('priceId={premiumMonthlyPriceId}')
    expect(flat).toContain('priceId={premiumAnnualPriceId}')
    expect(flat).toContain('price="$79 / month"')
    expect(flat).toContain('price="$790 / year"')
  })

  it('keeps the Pro rows and prices untouched', () => {
    expect(flat).toContain('priceId={monthlyPriceId}')
    expect(flat).toContain('priceId={annualPriceId}')
    expect(flat).toContain('price="$29 / month"')
    expect(flat).toContain('price="$290 / year"')
  })
})
