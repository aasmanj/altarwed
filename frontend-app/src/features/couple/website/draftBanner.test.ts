import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { shouldShowDraftBanner } from './DraftBanner'

// Issue #159: an unpublished ("draft") wedding site generates zero SEO and zero
// viral traffic, but couples can finish onboarding without realizing guests
// can't see it. The editor renders a persistent draft banner with an inline
// Publish action.
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the behavioral contract is verified two ways:
//   1. the pure shouldShowDraftBanner predicate, which encodes the show/hide
//      acceptance rules and fails on the pre-fix source (the export did not
//      exist);
//   2. source-level assertions that both editors mount the banner and wire its
//      Publish action to their existing publish handler.

// Built from a char code so this file itself contains no literal em dash.
const EM_DASH = String.fromCharCode(0x2014)

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('shouldShowDraftBanner (issue #159)', () => {
  it('shows the banner for an unpublished site that has not been dismissed', () => {
    expect(shouldShowDraftBanner(false, false)).toBe(true)
  })

  it('never shows the banner once the site is published', () => {
    // The core acceptance rule: publishing must make the banner disappear,
    // regardless of any prior dismissal.
    expect(shouldShowDraftBanner(true, false)).toBe(false)
    expect(shouldShowDraftBanner(true, true)).toBe(false)
  })

  it('hides the banner for a draft the couple dismissed this session', () => {
    expect(shouldShowDraftBanner(false, true)).toBe(false)
  })
})

describe('draft banner wiring (issue #159)', () => {
  it('banner copy tells the couple guests cannot see the draft, em-dash free', () => {
    const src = read('features/couple/website/DraftBanner.tsx')
    expect(src).toContain('Your site is a draft')
    expect(src).toContain('Publish')
    expect(src).not.toContain(EM_DASH)
  })

  // The classic editor's equivalent assertion here was removed along with the
  // classic editor itself (issue #181) -- the page builder is the only editor now.

  it('side-by-side editor renders the banner and reuses its publish handler', () => {
    const src = read('features/couple/website/blocks/SideBySideEditor.tsx')
    expect(src).toContain("import DraftBanner from '../DraftBanner'")
    expect(src).toContain('<DraftBanner')
    expect(src).toContain('isPublished={website.isPublished}')
    expect(src).toContain('onPublish={togglePublish}')
  })
})
