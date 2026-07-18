import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// The Meta Pixel installs a global `fbq` command bus on window and appends the
// async fbevents.js script. We pre-install a spy at window.fbq before loading the
// module: the snippet loader's `if (window.fbq) return` guard then short-circuits,
// so no real script tag is created (there is no jsdom here) and every fbq(...)
// command lands on the spy where we can assert exactly what was sent. This mirrors
// how analytics.test.ts mocks the posthog-js boundary.
const fbq = vi.fn()

// metaPixel.ts caches module-level flags (initialized/enabled), so each test
// imports a fresh module instance after configuring env + globals.
async function loadPixel() {
  vi.resetModules()
  return import('./metaPixel')
}

// Minimal browser globals. window carries the pre-installed fbq spy; document is
// only referenced after the snippet-loader early return, so an empty object is
// enough for these tests.
function stubBrowser(nav: Record<string, unknown> = {}) {
  vi.stubGlobal('navigator', nav)
  vi.stubGlobal('document', {})
  vi.stubGlobal('window', { fbq })
}

beforeEach(() => {
  fbq.mockClear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  // A configured pixel id so the only thing preventing a fire is the privacy
  // signal (or gate state) under test, not a missing id.
  vi.stubEnv('VITE_FB_PIXEL_ID', 'fb_test_id')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('initPixel configuration + privacy gate (issue #221)', () => {
  it('does nothing when VITE_FB_PIXEL_ID is unset', async () => {
    vi.stubEnv('VITE_FB_PIXEL_ID', '')
    stubBrowser({})
    const { initPixel, trackCompleteRegistration } = await loadPixel()

    initPixel()
    trackCompleteRegistration()

    // No id means the pixel never enables, so init and the conversion are no-ops.
    expect(fbq).not.toHaveBeenCalled()
  })

  it('does not load the pixel when Global Privacy Control is set', async () => {
    stubBrowser({ globalPrivacyControl: true })
    const { initPixel, trackCompleteRegistration } = await loadPixel()

    initPixel()
    trackCompleteRegistration()

    expect(fbq).not.toHaveBeenCalled()
  })

  it('does not load the pixel when Do Not Track is enabled', async () => {
    stubBrowser({ doNotTrack: '1' })
    const { initPixel, trackCompleteRegistration } = await loadPixel()

    initPixel()
    trackCompleteRegistration()

    expect(fbq).not.toHaveBeenCalled()
  })

  it('initializes the pixel with the configured id when no opt-out signal is present', async () => {
    stubBrowser({})
    const { initPixel } = await loadPixel()

    initPixel()

    expect(fbq).toHaveBeenCalledWith('init', 'fb_test_id')
  })
})

describe('CompleteRegistration conversion (issue #221)', () => {
  it('fires CompleteRegistration exactly once on a consenting signup', async () => {
    stubBrowser({})
    const { initPixel, trackCompleteRegistration } = await loadPixel()

    // Mirrors the RegisterPage success path when newUser.marketingConsent is true.
    initPixel()
    trackCompleteRegistration()

    const conversions = fbq.mock.calls.filter(
      ([cmd, event]) => cmd === 'track' && event === 'CompleteRegistration',
    )
    expect(conversions).toHaveLength(1)
  })

  it('does not fire when marketing consent was declined (initPixel never called)', async () => {
    stubBrowser({})
    const { trackCompleteRegistration } = await loadPixel()

    // A non-consenting couple: RegisterPage skips initPixel(), so the pixel is
    // still disabled and the conversion is dropped at the enabled gate.
    trackCompleteRegistration()

    expect(fbq).not.toHaveBeenCalled()
  })
})

describe('vendor money-path standard events (issue #372)', () => {
  it('fires InitiateCheckout only after the pixel is enabled', async () => {
    stubBrowser({})
    const { initPixel, trackInitiateCheckout } = await loadPixel()

    // Before init the pixel is disabled, so the event is dropped.
    trackInitiateCheckout()
    expect(fbq).not.toHaveBeenCalled()

    initPixel()
    trackInitiateCheckout()
    expect(fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', undefined)
  })

  it('fires Subscribe only after the pixel is enabled', async () => {
    stubBrowser({})
    const { initPixel, trackSubscribe } = await loadPixel()

    trackSubscribe()
    expect(fbq).not.toHaveBeenCalled()

    initPixel()
    trackSubscribe()
    expect(fbq).toHaveBeenCalledWith('track', 'Subscribe', undefined)
  })

  it('drops the money-path events under Global Privacy Control', async () => {
    stubBrowser({ globalPrivacyControl: true })
    const { initPixel, trackInitiateCheckout, trackSubscribe } = await loadPixel()

    initPixel()
    trackInitiateCheckout()
    trackSubscribe()

    expect(fbq).not.toHaveBeenCalled()
  })
})

describe('logout teardown (issue #221)', () => {
  it('never fires CompleteRegistration after logout has disabled the pixel', async () => {
    stubBrowser({})
    const { initPixel, trackCompleteRegistration, disablePixel } = await loadPixel()

    // Consenting couple signs up: conversion fires once.
    initPixel()
    trackCompleteRegistration()
    expect(fbq).toHaveBeenCalledWith('track', 'CompleteRegistration', undefined)

    // Logout disables the pixel; anything after must be a no-op.
    disablePixel()
    fbq.mockClear()
    trackCompleteRegistration()
    expect(fbq).not.toHaveBeenCalled()
  })
})

describe('pixel is not booted at module load (issue #221)', () => {
  it('main.tsx does not import or initialize the pixel', () => {
    const source = readFileSync(path.resolve(__dirname, '../../main.tsx'), 'utf8')
    expect(source).not.toContain('initPixel')
    expect(source).not.toContain('metaPixel')
  })

  it('RegisterPage boots the pixel before tracking the conversion, inside the consent branch', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../features/auth/RegisterPage.tsx'),
      'utf8',
    )
    const consentIdx = source.indexOf('newUser.marketingConsent')
    const initIdx = source.indexOf('initPixel()')
    const trackIdx = source.indexOf('trackCompleteRegistration()')
    expect(consentIdx).toBeGreaterThan(-1)
    expect(initIdx).toBeGreaterThan(consentIdx)
    expect(trackIdx).toBeGreaterThan(initIdx)
  })
})
