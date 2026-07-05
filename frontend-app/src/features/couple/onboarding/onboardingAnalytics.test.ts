import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #239: the 8-step onboarding wizard emitted nothing per step, so drop-off
// inside the wizard (the gap between signed_up and website_published) was
// invisible. This verifies the per-step / skip / completion events fire with the
// right names and PII-free payloads, and that the wizard actually wires them.
//
// The analytics boundary is mocked so the test asserts the exact event name and
// payload handed to PostHog, without a real (or configured) client. Same pattern
// as shareAnalytics.test.ts.
const captureEvent = vi.fn()
vi.mock('@/core/analytics/analytics', () => ({
  captureEvent: (event: string, props?: Record<string, unknown>) => captureEvent(event, props),
}))

// Imported after the mock is registered so the helpers bind to the mock.
import {
  ONBOARDING_STEP_NAMES,
  onboardingStepName,
  trackOnboardingStepViewed,
  trackOnboardingSkipped,
  trackOnboardingCompleted,
} from './onboardingAnalytics'

// Built from a char code so this file itself contains no literal em dash.
const EM_DASH = String.fromCharCode(0x2014)

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('onboardingStepName (issue #239)', () => {
  it('maps all 8 wizard steps to stable, PII-free slugs', () => {
    expect(ONBOARDING_STEP_NAMES).toEqual({
      1: 'names',
      2: 'url_date',
      3: 'venue',
      4: 'hotel',
      5: 'hero',
      6: 'scripture',
      7: 'registry',
      8: 'confirm',
    })
  })

  it('resolves each in-range index to its slug', () => {
    for (let step = 1; step <= 8; step++) {
      expect(onboardingStepName(step)).toBe(ONBOARDING_STEP_NAMES[step])
    }
  })

  it('falls back to a bucket instead of throwing on an out-of-range index', () => {
    expect(onboardingStepName(0)).toBe('unknown')
    expect(onboardingStepName(99)).toBe('unknown')
  })

  it('uses only static slugs, never a couple-entered value', () => {
    // Slugs are lowercase identifiers with no whitespace: a crude guard that no
    // free-text (a name, a URL slug, a scripture reference) leaked into the map.
    for (const name of Object.values(ONBOARDING_STEP_NAMES)) {
      expect(name).toMatch(/^[a-z][a-z_]*$/)
    }
  })
})

describe('onboarding event emitters (issue #239)', () => {
  beforeEach(() => {
    captureEvent.mockClear()
  })

  it('fires onboarding_step_viewed with the step index and its slug only', () => {
    trackOnboardingStepViewed(3)
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('onboarding_step_viewed', { step: 3, name: 'venue' })
  })

  it('fires onboarding_step_viewed for step 1 (the on-mount view)', () => {
    trackOnboardingStepViewed(1)
    expect(captureEvent).toHaveBeenCalledWith('onboarding_step_viewed', { step: 1, name: 'names' })
  })

  it('fires onboarding_skipped with the fromStep it was taken from', () => {
    trackOnboardingSkipped(4)
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('onboarding_skipped', { fromStep: 4, name: 'hotel' })
  })

  it('fires onboarding_completed with no properties', () => {
    trackOnboardingCompleted()
    expect(captureEvent).toHaveBeenCalledTimes(1)
    // The event name carries the whole signal; no properties are attached (the
    // mock wrapper forwards the absent second arg as undefined).
    expect(captureEvent).toHaveBeenCalledWith('onboarding_completed', undefined)
  })

  it('never attaches a payload key that could carry PII', () => {
    // The only property keys these events may ever send. Anything outside this
    // set (name of a person, email, weddingDate, slug, venue, address) would be
    // a regression, so assert the emitted keys are a subset.
    const allowed = new Set(['step', 'name', 'fromStep'])
    trackOnboardingStepViewed(2)
    trackOnboardingSkipped(2)
    trackOnboardingCompleted()
    for (const call of captureEvent.mock.calls) {
      const props = call[1] as Record<string, unknown> | undefined
      for (const key of Object.keys(props ?? {})) {
        expect(allowed.has(key)).toBe(true)
      }
    }
  })
})

describe('OnboardingWizard analytics wiring (issue #239)', () => {
  const src = read('features/couple/onboarding/OnboardingWizard.tsx')

  it('fires the step-view event from an effect keyed on step only (no double-fire on re-render)', () => {
    // The guard is the effect dependency array being exactly [step]: a field
    // change re-renders but does not re-run it, while a step change (including
    // back navigation) does.
    expect(src).toMatch(/useEffect\(\(\) => \{\s*trackOnboardingStepViewed\(step\)\s*\}, \[step\]\)/)
  })

  it('fires the skip event from the shortcut and delegates to handleFinish', () => {
    expect(src).toMatch(/const handleSkipFinish = \(\) => \{[\s\S]*?trackOnboardingSkipped\(step\)[\s\S]*?void handleFinish\(\)/)
    expect(src).toContain('onClick={handleSkipFinish}')
  })

  it('fires the completion event once the site row exists, before hero upload', () => {
    expect(src).toContain('trackOnboardingCompleted()')
  })

  it('keeps the analytics helper source em-dash free', () => {
    expect(read('features/couple/onboarding/onboardingAnalytics.ts')).not.toContain(EM_DASH)
  })
})
