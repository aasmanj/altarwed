import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// trackPixelEvent gates on hasConsented() and the presence of window.fbq. We mock
// the consent module so each test controls the consent decision directly, and
// pre-install an fbq spy on window to capture exactly what is sent (there is no
// real pixel snippet in this environment).
const consented = vi.fn<() => boolean>()
vi.mock('@/lib/consent', () => ({
  hasConsented: () => consented(),
}))

const fbq = vi.fn()

beforeEach(() => {
  fbq.mockClear()
  consented.mockReset()
  vi.stubGlobal('window', { fbq })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('trackPixelEvent (issue #372)', () => {
  it('fires the Meta standard event with params when the visitor has consented', async () => {
    consented.mockReturnValue(true)
    const { trackPixelEvent } = await import('./pixel')

    trackPixelEvent('Lead', { content_category: 'vendor_inquiry' })

    expect(fbq).toHaveBeenCalledTimes(1)
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', {
      content_category: 'vendor_inquiry',
    })
  })

  it('does not fire when the visitor has not consented', async () => {
    consented.mockReturnValue(false)
    const { trackPixelEvent } = await import('./pixel')

    trackPixelEvent('Lead', { content_category: 'vendor_inquiry' })

    expect(fbq).not.toHaveBeenCalled()
  })

  it('no-ops when the pixel snippet has not installed window.fbq yet', async () => {
    consented.mockReturnValue(true)
    vi.stubGlobal('window', {})
    const { trackPixelEvent } = await import('./pixel')

    // Must not throw even though fbq is absent.
    expect(() => trackPixelEvent('Lead')).not.toThrow()
    expect(fbq).not.toHaveBeenCalled()
  })
})
