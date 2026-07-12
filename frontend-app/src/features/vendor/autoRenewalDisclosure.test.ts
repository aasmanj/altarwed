import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  AUTO_RENEWAL_DISCLOSURE_HEADING,
  AUTO_RENEWAL_DISCLOSURE_BODY,
  AUTO_RENEWAL_CONSENT_LABEL,
  canStartCheckout,
} from './VendorSubscriptionPage'

// Behavioral guard for issue #386 (Legal P1): before a vendor is sent to Stripe for a
// recurring charge we must show a clear-and-conspicuous auto-renewal disclosure adjacent
// to the Subscribe button (price + renewal cadence + how to cancel) and capture affirmative
// consent to the recurring charge (FTC Negative Option Rule; CA ARL S17600).
//
// frontend-app's vitest runs in a plain node environment (no jsdom / testing-library), so,
// matching the sibling hardening tests (vendorBillingUnavailable, signupTermsAcceptance),
// the contract is verified with pure-logic assertions plus source-level assertions on the
// load-bearing markup. Each assertion fails on the pre-fix source and passes after.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Collapse JSX whitespace so a disclosure sentence broken across source lines still
// matches as one continuous string.
function normalize(src: string): string {
  return src.replace(/\s+/g, ' ')
}

describe('vendor auto-renewal disclosure copy (#386)', () => {
  it('discloses the monthly recurring price and cadence', () => {
    expect(AUTO_RENEWAL_DISCLOSURE_BODY).toContain('$29')
    expect(AUTO_RENEWAL_DISCLOSURE_BODY.toLowerCase()).toContain('every month')
  })

  it('discloses the annual recurring price and cadence', () => {
    expect(AUTO_RENEWAL_DISCLOSURE_BODY).toContain('$290')
    expect(AUTO_RENEWAL_DISCLOSURE_BODY.toLowerCase()).toContain('every year')
  })

  it('states the subscription renews automatically until cancelled', () => {
    const body = AUTO_RENEWAL_DISCLOSURE_BODY.toLowerCase()
    expect(body).toContain('renews automatically')
    expect(body).toContain('until you cancel')
  })

  it('explains how to cancel', () => {
    expect(AUTO_RENEWAL_DISCLOSURE_BODY.toLowerCase()).toContain('billing portal')
    expect(AUTO_RENEWAL_DISCLOSURE_BODY.toLowerCase()).toContain('cancel')
  })

  it('has a non-empty heading and an affirmative consent label authorising recurring charges', () => {
    expect(AUTO_RENEWAL_DISCLOSURE_HEADING.length).toBeGreaterThan(0)
    const label = AUTO_RENEWAL_CONSENT_LABEL.toLowerCase()
    expect(label).toContain('authorize')
    expect(label).toContain('recurring')
    expect(label).toContain('until i cancel')
  })

  it('uses no em dashes in the legal copy', () => {
    for (const copy of [
      AUTO_RENEWAL_DISCLOSURE_HEADING,
      AUTO_RENEWAL_DISCLOSURE_BODY,
      AUTO_RENEWAL_CONSENT_LABEL,
    ]) {
      expect(copy).not.toContain('\u2014')
    }
  })
})

describe('vendor checkout consent gate (#386)', () => {
  it('blocks checkout until affirmative consent is given', () => {
    // Valid price + not loading, but no consent yet -> cannot start checkout.
    expect(canStartCheckout('price_123', false, false)).toBe(false)
  })

  it('allows checkout once consented with a valid price and no request in flight', () => {
    expect(canStartCheckout('price_123', true, false)).toBe(true)
  })

  it('still blocks checkout when the price ID is missing even after consent', () => {
    expect(canStartCheckout(null, true, false)).toBe(false)
    expect(canStartCheckout('', true, false)).toBe(false)
  })

  it('blocks checkout while a request is already in flight', () => {
    expect(canStartCheckout('price_123', true, true)).toBe(false)
  })
})

describe('vendor auto-renewal disclosure markup (#386)', () => {
  const src = read('features/vendor/VendorSubscriptionPage.tsx')
  const flat = normalize(src)

  it('renders the disclosure heading and body in the upgrade panel', () => {
    expect(flat).toContain('{AUTO_RENEWAL_DISCLOSURE_HEADING}')
    expect(flat).toContain('{AUTO_RENEWAL_DISCLOSURE_BODY}')
  })

  it('renders a consent checkbox wired to the disclosure copy', () => {
    expect(flat).toContain('type="checkbox"')
    expect(flat).toContain('checked={consented}')
    expect(flat).toContain('{AUTO_RENEWAL_CONSENT_LABEL}')
  })

  it('gates the Subscribe button on the consent gate and links it to the disclosure', () => {
    expect(flat).toContain('canStartCheckout(priceId, consented, loading)')
    expect(flat).toContain('disabled={!ready}')
    expect(flat).toContain('aria-describedby={disclosureId}')
  })
})
