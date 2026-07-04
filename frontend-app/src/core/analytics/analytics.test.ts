import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Mock the posthog-js boundary so we can assert exactly what config we hand to
// posthog.init without loading a real client or making any network call.
const init = vi.fn()
const capture = vi.fn()
const identify = vi.fn()
const reset = vi.fn()
vi.mock('posthog-js', () => ({
  default: {
    init: (...args: unknown[]) => init(...args),
    capture: (...args: unknown[]) => capture(...args),
    identify: (...args: unknown[]) => identify(...args),
    reset: (...args: unknown[]) => reset(...args),
  },
}))

// analytics.ts caches an `enabled` module flag, so each test imports a fresh
// module instance after configuring env + navigator. Returns initAnalytics.
async function loadInitAnalytics() {
  vi.resetModules()
  const mod = await import('./analytics')
  return mod.initAnalytics
}

describe('initAnalytics privacy gate (issue #218)', () => {
  beforeEach(() => {
    init.mockClear()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    // A configured PostHog key so the only thing preventing init is the privacy
    // signal under test, not a missing key.
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('does not initialize PostHog when Global Privacy Control is set', async () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    const initAnalytics = await loadInitAnalytics()

    initAnalytics()

    expect(init).not.toHaveBeenCalled()
  })

  it('does not initialize PostHog when Do Not Track is enabled', async () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    const initAnalytics = await loadInitAnalytics()

    initAnalytics()

    expect(init).not.toHaveBeenCalled()
  })

  it('initializes PostHog with autocapture disabled when no opt-out signal is present', async () => {
    vi.stubGlobal('navigator', {})
    const initAnalytics = await loadInitAnalytics()

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
    const initAnalytics = await loadInitAnalytics()

    initAnalytics()

    expect(init).not.toHaveBeenCalled()
  })
})

describe('analytics is not booted at module load (issue #218)', () => {
  it('main.tsx does not import or call initAnalytics', () => {
    const source = readFileSync(path.resolve(__dirname, '../../main.tsx'), 'utf8')
    expect(source).not.toContain('initAnalytics')
  })
})
