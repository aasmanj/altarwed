import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Mock the posthog-js boundary so we can assert exactly what we hand to PostHog
// without loading a real client or making any network call.
const init = vi.fn()
const capture = vi.fn()
const identify = vi.fn()
const reset = vi.fn()
const optOut = vi.fn()
const optIn = vi.fn()
vi.mock('posthog-js', () => ({
  default: {
    init: (...args: unknown[]) => init(...args),
    capture: (...args: unknown[]) => capture(...args),
    identify: (...args: unknown[]) => identify(...args),
    reset: (...args: unknown[]) => reset(...args),
    opt_out_capturing: (...args: unknown[]) => optOut(...args),
    opt_in_capturing: (...args: unknown[]) => optIn(...args),
  },
}))

// analytics.ts caches module-level flags, so each test imports a fresh module
// instance after configuring env + navigator.
async function loadAnalytics() {
  vi.resetModules()
  return import('./analytics')
}

beforeEach(() => {
  init.mockClear()
  capture.mockClear()
  identify.mockClear()
  reset.mockClear()
  optOut.mockClear()
  optIn.mockClear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  // A configured PostHog key so the only thing preventing init is the privacy
  // signal (or gate state) under test, not a missing key.
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('initAnalytics privacy gate (issue #218)', () => {
  it('does not initialize PostHog when Global Privacy Control is set', async () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    const { initAnalytics } = await loadAnalytics()

    initAnalytics()

    expect(init).not.toHaveBeenCalled()
  })

  it('does not initialize PostHog when Do Not Track is enabled', async () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    const { initAnalytics } = await loadAnalytics()

    initAnalytics()

    expect(init).not.toHaveBeenCalled()
  })

  it('initializes PostHog with autocapture disabled when no opt-out signal is present', async () => {
    vi.stubGlobal('navigator', {})
    const { initAnalytics } = await loadAnalytics()

    initAnalytics()

    expect(init).toHaveBeenCalledTimes(1)
    const [key, config] = init.mock.calls[0] as [string, Record<string, unknown>]
    expect(key).toBe('phc_test_key')
    // Autocapture OFF so clicked-element text (guest names/emails/addresses)
    // never ships to PostHog.
    expect(config.autocapture).toBe(false)
    // Session recording stays off for the same PII reason.
    expect(config.disable_session_recording).toBe(true)
  })

  it('does not initialize PostHog when no key is configured, even without an opt-out signal', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.stubGlobal('navigator', {})
    const { initAnalytics } = await loadAnalytics()

    initAnalytics()

    expect(init).not.toHaveBeenCalled()
  })
})

describe('signup consent path captures signed_up (issue #218 review, BLOCKER)', () => {
  it('boots analytics before capturing so a consenting signup fires signed_up exactly once', async () => {
    vi.stubGlobal('navigator', {})
    const { initAnalytics, identifyUser, captureEvent } = await loadAnalytics()

    // Mirrors the RegisterPage success path when marketingConsent is true.
    initAnalytics()
    identifyUser('couple-123', { role: 'COUPLE' })
    captureEvent('signed_up', { has_wedding_date: true })

    expect(init).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith('signed_up', { has_wedding_date: true })
  })

  it('drops the event when captureEvent runs before analytics is enabled (the pre-fix bug)', async () => {
    vi.stubGlobal('navigator', {})
    const { captureEvent } = await loadAnalytics()

    // Without initAnalytics first, the module is disabled and the event is lost.
    // This is exactly why RegisterPage must boot analytics before capturing.
    captureEvent('signed_up', { has_wedding_date: true })

    expect(capture).not.toHaveBeenCalled()
  })
})

describe('logout disables capturing until re-consent (issue #218 review, SHOULD-FIX)', () => {
  it('sends nothing after logout until a consenting login re-enables analytics', async () => {
    vi.stubGlobal('navigator', {})
    const { initAnalytics, captureEvent, disableAnalytics } = await loadAnalytics()

    // Consenting couple logged in: capturing works.
    initAnalytics()
    captureEvent('website_published')
    expect(capture).toHaveBeenCalledTimes(1)

    // Logout: opt out of capturing and rotate identity.
    disableAnalytics()
    expect(optOut).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledTimes(1)

    // A second, non-consenting person on the shared browser sends nothing.
    capture.mockClear()
    captureEvent('share_clicked')
    expect(capture).not.toHaveBeenCalled()

    // Next consenting login re-enables without a second (warned) init call.
    initAnalytics()
    expect(init).toHaveBeenCalledTimes(1)
    expect(optIn).toHaveBeenCalledTimes(1)
    captureEvent('share_clicked')
    expect(capture).toHaveBeenCalledTimes(1)
  })
})

describe('analytics is not booted at module load (issue #218)', () => {
  it('main.tsx does not import or call initAnalytics', () => {
    const source = readFileSync(path.resolve(__dirname, '../../main.tsx'), 'utf8')
    expect(source).not.toContain('initAnalytics')
  })

  it('RegisterPage boots analytics before capturing signed_up (ordering guard)', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../features/auth/RegisterPage.tsx'),
      'utf8',
    )
    const initIdx = source.indexOf('initAnalytics()')
    const captureIdx = source.indexOf("captureEvent('signed_up'")
    expect(initIdx).toBeGreaterThan(-1)
    expect(captureIdx).toBeGreaterThan(-1)
    expect(initIdx).toBeLessThan(captureIdx)
  })
})
