import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  runFinishAttempt,
  initialFinishFlowState,
  OPTIONAL_DETAILS_NOTICE,
  type FinishFlowDeps,
} from './OnboardingWizard'

// Issue #304: onboarding create succeeded but the follow-up optional-fields
// PATCH failed, and retrying re-ran the POST against a slug that now exists,
// producing a nonsensical conflict on the couple's own site. The finish flow is
// now a resumable state machine (runFinishAttempt): each attempt records how
// far it got, so a retry skips creation and re-runs only the failed PATCH (and
// pending hero upload), and a second PATCH failure exits to the editor with a
// non-blocking notice instead of stranding the couple on the wizard.
//
// frontend-app's vitest runs in node (no jsdom / testing-library), so the
// behavioral contract lives in the extracted pure function, driven here with
// mock dependencies, plus source-level assertions that the wizard actually
// wires it (draft cleared only on the leave path).

// Built from a char code so this file itself contains no literal em dash.
const EM_DASH = String.fromCharCode(0x2014)

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

const SITE = { id: 'site-1', slug: 'amy-and-joe' }

function makeDeps(overrides: Partial<FinishFlowDeps> = {}): FinishFlowDeps {
  return {
    createSite: vi.fn().mockResolvedValue(SITE),
    patchOptional: vi.fn().mockResolvedValue(undefined),
    uploadHero: vi.fn().mockResolvedValue(undefined),
    optionalFields: { venueName: 'Grace Chapel' },
    hasHeroFile: false,
    heroErrorReason: () => 'The hero photo failed to upload.',
    trackCompleted: vi.fn(),
    ...overrides,
  }
}

describe('runFinishAttempt happy path (issue #304)', () => {
  it('creates, patches, and leaves cleanly with no notice', async () => {
    const deps = makeDeps()
    const outcome = await runFinishAttempt(initialFinishFlowState(), deps)

    expect(outcome.kind).toBe('leave')
    if (outcome.kind === 'leave') expect(outcome.notice).toBeNull()
    expect(deps.createSite).toHaveBeenCalledTimes(1)
    expect(deps.patchOptional).toHaveBeenCalledWith({ venueName: 'Grace Chapel' })
    expect(deps.trackCompleted).toHaveBeenCalledTimes(1)
  })

  it('skips the PATCH entirely when every optional step was skipped', async () => {
    const deps = makeDeps({ optionalFields: {} })
    const outcome = await runFinishAttempt(initialFinishFlowState(), deps)

    expect(outcome.kind).toBe('leave')
    expect(deps.patchOptional).not.toHaveBeenCalled()
  })
})

describe('retry after create-ok / patch-fail (acceptance 1)', () => {
  it('holds the created id and slug in state after the failed attempt', async () => {
    const deps = makeDeps({ patchOptional: vi.fn().mockRejectedValue(new Error('boom')) })
    const outcome = await runFinishAttempt(initialFinishFlowState(), deps)

    expect(outcome.kind).toBe('stay')
    expect(outcome.state.createdSite).toEqual(SITE)
    expect(outcome.state.optionalSaved).toBe(false)
    expect(outcome.state.patchFailureCount).toBe(1)
    // A failed attempt is not a completion.
    expect(deps.trackCompleted).not.toHaveBeenCalled()
  })

  it('a retry does not call create again and re-runs only the failed PATCH', async () => {
    const createSite = vi.fn().mockResolvedValue(SITE)
    const patchOptional = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined)
    const trackCompleted = vi.fn()
    const deps = makeDeps({ createSite, patchOptional, trackCompleted })

    const first = await runFinishAttempt(initialFinishFlowState(), deps)
    expect(first.kind).toBe('stay')

    const second = await runFinishAttempt(first.state, deps)
    expect(second.kind).toBe('leave')
    if (second.kind === 'leave') expect(second.notice).toBeNull()

    // The whole point of #304: creation ran exactly once across both attempts,
    // so the retry can never hit a slug conflict against the couple's own site.
    expect(createSite).toHaveBeenCalledTimes(1)
    expect(patchOptional).toHaveBeenCalledTimes(2)
    expect(trackCompleted).toHaveBeenCalledTimes(1)
  })

  it('a retry re-runs a pending hero upload against the held site id', async () => {
    const uploadHero = vi.fn().mockResolvedValue(undefined)
    const patchOptional = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined)
    const deps = makeDeps({ patchOptional, uploadHero, hasHeroFile: true })

    const first = await runFinishAttempt(initialFinishFlowState(), deps)
    expect(first.kind).toBe('stay')
    // The upload never ran on the failed attempt (site page order: it follows
    // the PATCH), so nothing was half-done.
    expect(uploadHero).not.toHaveBeenCalled()

    const second = await runFinishAttempt(first.state, deps)
    expect(second.kind).toBe('leave')
    expect(uploadHero).toHaveBeenCalledTimes(1)
    expect(uploadHero).toHaveBeenCalledWith(SITE.id)
  })

  it('a failed create leaves state empty so the retry does create', async () => {
    const createSite = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(SITE)
    const deps = makeDeps({ createSite })

    const first = await runFinishAttempt(initialFinishFlowState(), deps)
    expect(first.kind).toBe('stay')
    expect(first.state.createdSite).toBeNull()

    const second = await runFinishAttempt(first.state, deps)
    expect(second.kind).toBe('leave')
    expect(createSite).toHaveBeenCalledTimes(2)
  })

  it('surfaces the backend detail on the first PATCH failure and stays', async () => {
    const err = { response: { data: { detail: 'hotelUrl must be a valid URL' } } }
    const deps = makeDeps({ patchOptional: vi.fn().mockRejectedValue(err) })
    const outcome = await runFinishAttempt(initialFinishFlowState(), deps)

    expect(outcome.kind).toBe('stay')
    if (outcome.kind === 'stay') expect(outcome.error).toBe('hotelUrl must be a valid URL')
  })
})

describe('double PATCH failure leaves with a notice (acceptance 2)', () => {
  it('navigates to the editor with the non-blocking notice instead of stranding the couple', async () => {
    const createSite = vi.fn().mockResolvedValue(SITE)
    const patchOptional = vi.fn().mockRejectedValue(new Error('still down'))
    const trackCompleted = vi.fn()
    const deps = makeDeps({ createSite, patchOptional, trackCompleted })

    const first = await runFinishAttempt(initialFinishFlowState(), deps)
    expect(first.kind).toBe('stay')

    const second = await runFinishAttempt(first.state, deps)
    expect(second.kind).toBe('leave')
    if (second.kind === 'leave') {
      expect(second.notice).toBe(OPTIONAL_DETAILS_NOTICE)
      expect(second.notice).toContain('Your site was created')
      expect(second.notice).toContain('editor')
    }
    expect(createSite).toHaveBeenCalledTimes(1)
    expect(patchOptional).toHaveBeenCalledTimes(2)
    // The site row exists and the couple actually left, so the completion
    // event still fires exactly once (issue #239 funnel stays intact).
    expect(trackCompleted).toHaveBeenCalledTimes(1)
  })

  it('still attempts the pending hero upload on the give-up exit and folds a failure into one notice', async () => {
    const patchOptional = vi.fn().mockRejectedValue(new Error('still down'))
    const uploadHero = vi.fn().mockRejectedValue(new Error('too large'))
    const deps = makeDeps({ patchOptional, uploadHero, hasHeroFile: true })

    const first = await runFinishAttempt(initialFinishFlowState(), deps)
    const second = await runFinishAttempt(first.state, deps)

    expect(second.kind).toBe('leave')
    if (second.kind === 'leave') {
      expect(second.notice).toContain('some details did not save')
      expect(second.notice).toContain('The hero photo failed to upload.')
    }
    expect(uploadHero).toHaveBeenCalledWith(SITE.id)
  })

  it('keeps the hero-only fallback notice when the PATCH succeeded', async () => {
    const uploadHero = vi.fn().mockRejectedValue(new Error('too large'))
    const deps = makeDeps({ uploadHero, hasHeroFile: true })

    const outcome = await runFinishAttempt(initialFinishFlowState(), deps)
    expect(outcome.kind).toBe('leave')
    if (outcome.kind === 'leave') {
      expect(outcome.notice).toContain('the hero photo could not be added')
      expect(outcome.notice).toContain('add or replace it from the editor')
    }
  })
})

describe('wizard wiring (acceptance 3: draft cleared only on leave)', () => {
  const src = read('features/couple/onboarding/OnboardingWizard.tsx')

  it('clears the sessionStorage draft in exactly one place: the leave branch', () => {
    const clears = src.match(/clearPersistentState\(ONBOARDING_KEY\)/g) ?? []
    expect(clears).toHaveLength(1)
    // ...and that one place is inside the leave branch, immediately before the
    // navigate to the editor, so a failed attempt keeps the couple's draft.
    expect(src).toMatch(
      /if \(outcome\.kind === 'leave'\) \{[\s\S]*?clearPersistentState\(ONBOARDING_KEY\)[\s\S]*?navigate\('\/dashboard\/website\/editor'/,
    )
  })

  it('holds the finish flow state across attempts and passes it back in', () => {
    expect(src).toContain('finishFlowRef')
    expect(src).toContain('runFinishAttempt(finishFlowRef.current')
    expect(src).toContain('finishFlowRef.current = outcome.state')
  })

  it('passes the non-blocking notice to the editor via router state', () => {
    expect(src).toContain("{ state: { notice: outcome.notice } }")
  })

  it('keeps this test source em-dash free', () => {
    expect(read('features/couple/onboarding/onboardingSubmitRetry.test.ts')).not.toContain(EM_DASH)
  })
})
