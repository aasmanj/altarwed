import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  buildOptionalWebsiteFields,
  shouldShowFinishShortcut,
  type OptionalWebsiteInput,
} from './OnboardingWizard'

// Issue #160: only steps 1-2 of the onboarding wizard are required, but reaching
// "Create my site" forced a couple to tap "Skip for now" through steps 3-7 --
// five extra chances for a paid-ad arrival to bounce. The fix adds a visible
// "Skip the rest, create my site now" shortcut from step 2 onward that jumps
// straight to creation using the same defaults the per-step skips produce.
//
// frontend-app's vitest runs in node (no jsdom / testing-library), so the
// behavioral contract is verified two ways:
//   1. the pure shouldShowFinishShortcut predicate + the buildOptionalWebsiteFields
//      payload builder, which encode "reachable from step 2" and "skipping saves
//      the same defaults" and did not exist before this change;
//   2. source-level assertions that the shortcut is rendered and wired to the
//      same handleFinish the final step uses.

// Built from a char code so this file itself contains no literal em dash.
const EM_DASH = String.fromCharCode(0x2014)

const EMPTY: OptionalWebsiteInput = {
  venueName: '', venueAddress: '', venueCity: '', venueState: '', ceremonyTime: '',
  hotelName: '', hotelUrl: '', hotelDetails: '',
  scriptureReference: '', scriptureText: '',
  registryUrl1: '', registryLabel1: '',
  heroPhotoUrl: null,
}

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('shouldShowFinishShortcut (issue #160)', () => {
  it('does not offer the shortcut on step 1 (names are still required)', () => {
    expect(shouldShowFinishShortcut(1)).toBe(false)
  })

  it('offers the shortcut from step 2 onward, the first fully-optional point', () => {
    // Acceptance: from step 2 a user can reach a created site without visiting 3-7.
    expect(shouldShowFinishShortcut(2)).toBe(true)
    expect(shouldShowFinishShortcut(3)).toBe(true)
    expect(shouldShowFinishShortcut(7)).toBe(true)
  })

  it('does not duplicate the shortcut on the final confirm step', () => {
    // Step 8 already has its own "Create my site" button.
    expect(shouldShowFinishShortcut(8)).toBe(false)
  })
})

describe('buildOptionalWebsiteFields (issue #160)', () => {
  it('skipping every optional step saves nothing (the per-step-skip defaults)', () => {
    // Acceptance: skipping populates the same defaults the per-step "Skip for
    // now" produces. Every field empty must yield an empty payload, so the
    // shortcut path and the tap-through path write identical data.
    expect(buildOptionalWebsiteFields(EMPTY)).toEqual({})
  })

  it('only sends fields the couple actually entered, trimmed', () => {
    const payload = buildOptionalWebsiteFields({
      ...EMPTY,
      venueName: '  Grace Chapel  ',
      heroPhotoUrl: 'https://example.com/hero.jpg',
    })
    expect(payload).toEqual({
      venueName: 'Grace Chapel',
      heroPhotoUrl: 'https://example.com/hero.jpg',
    })
  })

  it('treats whitespace-only entries as skipped', () => {
    expect(buildOptionalWebsiteFields({ ...EMPTY, hotelName: '   ' })).toEqual({})
  })
})

describe('finish shortcut wiring (issue #160)', () => {
  const src = read('features/couple/onboarding/OnboardingWizard.tsx')

  it('renders a visible skip-to-finish control gated on the shortcut predicate', () => {
    expect(src).toContain('shouldShowFinishShortcut(step)')
    expect(src).toContain('Skip the rest, create my site now')
  })

  it('wires the shortcut to the same handleFinish the confirm step uses', () => {
    // Reusing handleFinish (not a new save path) is what guarantees the
    // shortcut and the tap-through flow save identical data.
    expect(src).toContain('onClick={handleFinish}')
  })

  it('disables the shortcut until the required slug exists', () => {
    expect(src).toContain('disabled={submitting || !slug.trim()}')
  })

  it('keeps the wizard source em-dash free', () => {
    expect(src).not.toContain(EM_DASH)
  })
})
