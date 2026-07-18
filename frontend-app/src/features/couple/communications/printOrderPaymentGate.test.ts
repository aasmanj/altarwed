import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { deliveryStatusStyle } from './CommunicationsPage'

// Issues #59 (payment gate) + #53 (async batch): frontend-app's vitest runs in a node
// environment (no jsdom / testing-library), so the behavioral contract is verified two ways,
// matching the pattern in draftBanner.test.ts --
//   1. the pure deliveryStatusStyle predicate (a genuine mapping function worth unit testing
//      directly, now covering the new PENDING recipient state)
//   2. source-level assertions that the checkout-redirect, review-before-pay, and
//      warnings/exclusions UI are actually wired up, since a mid-flow payment redirect can't be
//      exercised without a browser.

const EM_DASH = String.fromCharCode(0x2014)

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('deliveryStatusStyle (issue #59/#53)', () => {
  it('labels a PENDING recipient as awaiting payment, not a failure', () => {
    // PENDING is the interim state a recipient sits in from order-creation until the async
    // Lob batch processes it (issue #53) -- it must read as "not yet", never as an error.
    expect(deliveryStatusStyle('PENDING')).toEqual({ label: 'Awaiting payment', cls: 'bg-stone-100 text-stone-500' })
  })

  it('still labels FAILED distinctly from PENDING', () => {
    expect(deliveryStatusStyle('FAILED').label).toBe('Failed')
    expect(deliveryStatusStyle('FAILED').cls).toContain('rose')
  })

  it('is case-insensitive on the PENDING check', () => {
    expect(deliveryStatusStyle('pending').label).toBe('Awaiting payment')
  })

  it('still handles Lob tracking event names unaffected by the PENDING addition', () => {
    expect(deliveryStatusStyle('Delivered').label).toBe('Delivered')
    expect(deliveryStatusStyle('In Transit').label).toBe('In Transit')
    expect(deliveryStatusStyle(null).label).toBe('Submitted')
  })
})

describe('payment gate UI wiring (issue #59/#53)', () => {
  const src = read('features/couple/communications/CommunicationsPage.tsx')

  it('redirects to Stripe Checkout only after an explicit confirm, never automatically', () => {
    // The couple must see the exact charge and any exclusions before leaving for Stripe --
    // confirmPayment is only invoked from the review panel's button, not from handleSubmit.
    expect(src).toContain('function confirmPayment')
    expect(src).toContain('window.location.href = pendingCheckout.checkoutUrl')
    expect(src).toContain('<PaymentReviewPanel')
  })

  it('shows excluded guests and duplicate-address warnings before payment, not after', () => {
    expect(src).toContain('result.excludedGuests')
    expect(src).toContain('result.warnings')
  })

  it('handles the Stripe success/cancel return without re-charging on refresh', () => {
    expect(src).toContain("searchParams.get('printOrder')")
    expect(src).toContain("next.delete('printOrder')")
  })

  it('surfaces real USPS tracking, and is honest that it is not a delivery guarantee', () => {
    expect(src).toContain('trackingNumber')
    expect(src).toContain('expectedDeliveryDate')
    // Must disclaim, never assert a guarantee outright -- USPS First-Class Mail doesn't offer one.
    expect(src).toContain('not a guarantee')
    expect(src).not.toContain('we guarantee')
    expect(src).not.toContain('guaranteed delivery.')
  })

  it('reflects the $2.00/postcard price everywhere, not the old $1.50', () => {
    expect(src).toContain('COST_PER_POSTCARD_CENTS = 200')
    expect(src).not.toContain('$1.50')
  })

  it('contains no em dashes anywhere in the new copy', () => {
    expect(src).not.toContain(EM_DASH)
  })
})

describe('print card templates + accent + position picker (issue #362)', () => {
  const src = read('features/couple/communications/CommunicationsPage.tsx')
  const helpers = read('features/couple/communications/printTemplate.ts')

  it('offers the new Minimal, Botanical, and Dark elegant templates', () => {
    expect(src).toContain('SAVE_THE_DATE_MINIMAL')
    expect(src).toContain('SAVE_THE_DATE_BOTANICAL')
    expect(src).toContain('SAVE_THE_DATE_DARK_ELEGANT')
    expect(src).toContain('INVITATION_MINIMAL')
    expect(src).toContain('INVITATION_BOTANICAL')
    expect(src).toContain('INVITATION_DARK_ELEGANT')
  })

  it('sends the composed templateKey (base plus overlay suffix) to the backend', () => {
    expect(src).toContain('composePrintTemplateKey(templateKey, textPosition, overlayTheme)')
    expect(src).toContain('templateKey: composedTemplateKey')
  })

  it('drives the card accent from the couple website accentColor, sanitized', () => {
    expect(src).toContain('sanitizeAccent(website?.accentColor)')
    expect(helpers).not.toContain('accentColor') // helpers stay pure; accent is applied in the page
  })

  it('renders the 3x3 position picker and light/dark overlay toggle for photo cards', () => {
    expect(src).toContain('TEXT_POSITIONS.map')
    expect(src).toContain("role=\"radiogroup\"")
    expect(src).toContain('setTextPosition(pos)')
    expect(src).toContain('setOverlayTheme(o.key)')
    // The picker only shows for a photo template.
    expect(src).toContain('{isPhoto && (')
  })

  it('rotates the idempotency key when the overlay position or theme changes', () => {
    expect(src).toContain('[orderType, templateKey, cardSize, textPosition, overlayTheme, selectedIds]')
  })

  it('has no em dashes in the new template files', () => {
    expect(src).not.toContain(EM_DASH)
    expect(helpers).not.toContain(EM_DASH)
  })
})
