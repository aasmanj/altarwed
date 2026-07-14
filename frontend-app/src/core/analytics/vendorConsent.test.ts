import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setVendorMarketingConsent, hasVendorMarketingConsent } from './vendorConsent'

// A minimal in-memory localStorage so the store's persistence can be asserted
// without a real browser. Mirrors the browser API surface the module touches.
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
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('vendor marketing consent store (issue #372)', () => {
  it('defaults to not consented before any choice is made', () => {
    expect(hasVendorMarketingConsent()).toBe(false)
  })

  it('persists an opt-in so the post-Stripe return page can re-read it', () => {
    setVendorMarketingConsent(true)
    expect(hasVendorMarketingConsent()).toBe(true)
  })

  it('records an explicit opt-out as not consented', () => {
    setVendorMarketingConsent(true)
    setVendorMarketingConsent(false)
    expect(hasVendorMarketingConsent()).toBe(false)
  })
})
