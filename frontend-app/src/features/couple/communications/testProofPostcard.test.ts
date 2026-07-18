import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #208 (test postcard proof): frontend-app's vitest runs in a node environment (no
// jsdom / testing-library), so like printOrderPaymentGate.test.ts the behavioral contract is
// verified via source-level assertions -- the mid-flow Stripe redirect cannot be exercised
// without a browser.

const EM_DASH = String.fromCharCode(0x2014)

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('test postcard proof wiring (issue #208)', () => {
  const page = read('features/couple/communications/CommunicationsPage.tsx')
  const hooks = read('features/couple/communications/usePrintOrders.ts')

  it('posts the test order to its own dedicated endpoint, never the batch endpoint', () => {
    expect(hooks).toContain('/test-proof')
    expect(hooks).toContain('useCreateTestPrintOrder')
    // The test payload has no guestIds field: destination is the couple's own address.
    expect(hooks.slice(hooks.indexOf('CreateTestPrintOrderPayload'))).not.toContain('guestIds')
  })

  it('keeps a SEPARATE idempotency key for the test, so a test and a batch of the same design cannot collide', () => {
    expect(page).toContain('testIdempotencyKey')
    expect(page).toContain('setTestIdempotencyKey(crypto.randomUUID())')
    // The test key rotates when the destination address changes -- a replay must never mail an
    // old address.
    const rotation = page.slice(page.indexOf('setTestIdempotencyKey(crypto.randomUUID())'))
    expect(rotation.slice(0, 400)).toContain('returnAddressLine1')
  })

  it('goes through the same review-before-pay panel as the batch order, never straight to Stripe', () => {
    // handleSendTest must set pendingCheckout (rendering PaymentReviewPanel) rather than
    // assigning window.location itself.
    const start = page.indexOf('async function handleSendTest')
    const end = page.indexOf('async function handleSubmit', start)
    const handler = page.slice(start, end === -1 ? undefined : end)
    expect(handler).toContain('setPendingCheckout(result)')
    expect(handler).not.toContain('window.location')
  })

  it('is priced at the same per-postcard rate as the batch, never free', () => {
    // The button label and confirm copy derive from COST_PER_POSTCARD_CENTS, not a hardcoded
    // different (or zero) test price.
    const testBlock = page.slice(page.indexOf('Optional: proof it first'))
    expect(testBlock.slice(0, 1600)).toContain('COST_PER_POSTCARD_CENTS')
    expect(page).not.toContain('free test')
  })

  it('blocks a photo-template test when no couple photo exists, same as the batch flow', () => {
    const blockerFn = page.slice(page.indexOf('function testBlockerHint'), page.indexOf('const testBlocker'))
    expect(blockerFn).toContain("endsWith('_PHOTO')")
    expect(blockerFn).toContain('heroPhotoUrl')
  })

  it('labels the test order honestly in Past orders and handles its guest-less recipient', () => {
    expect(page).toContain("TEST_PROOF: 'Test postcard'")
    // A TEST_PROOF recipient has a null guestId; the list must not crash on .slice of null.
    expect(page).toContain('You (test postcard)')
    expect(page).toContain("key={r.guestId ?? 'self'}")
    expect(hooks).toContain('guestId: string | null')
  })

  it('contains no em dashes anywhere in the new copy', () => {
    expect(page).not.toContain(EM_DASH)
    expect(hooks).not.toContain(EM_DASH)
  })
})
