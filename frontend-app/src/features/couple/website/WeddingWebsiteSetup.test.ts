import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { suggestSlug, slugAfterNameChange } from './WeddingWebsiteSetup'

// Issue #188: two bugs in the wedding-website setup wizard's first screen.
//   1. Editing a name field after the couple hand-edited their slug silently
//      overwrote the custom URL. slugAfterNameChange encodes the fix: once the
//      slug is "touched", name edits must never overwrite it.
//   2. The create-error message had no ARIA live region, so screen-reader users
//      got no feedback when submit failed. The container now carries role="alert".
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the contract is verified two ways: the pure slugAfterNameChange decision
// function, and a source-level assertion that the error container is a live
// region.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('suggestSlug', () => {
  it('derives a lowercase, hyphenated slug from two names', () => {
    expect(suggestSlug('Jordan', 'Sarah')).toBe('jordan-and-sarah')
  })

  it('collapses non-alphanumeric runs and trims leading/trailing hyphens', () => {
    expect(suggestSlug("Mary Anne", "O'Brien")).toBe('mary-anne-and-o-brien')
  })
})

describe('slugAfterNameChange (issue #188)', () => {
  it('auto-suggests from the names while the slug is untouched', () => {
    // A couple who never edits the slug field keeps getting it derived from
    // their names, exactly as before.
    expect(slugAfterNameChange(false, 'jordan-and-sarah', 'Jordan', 'Sara')).toBe('jordan-and-sara')
  })

  it('keeps the custom slug once the couple has hand-edited it', () => {
    // The core acceptance rule: after a manual slug edit, fixing a typo in a
    // name field must not clobber the custom URL.
    expect(slugAfterNameChange(true, 'our-big-day', 'Jordann', 'Sarah')).toBe('our-big-day')
  })

  it('does not overwrite even when the custom slug happens to look empty', () => {
    expect(slugAfterNameChange(true, '', 'Jordan', 'Sarah')).toBe('')
  })
})

describe('WeddingWebsiteSetup source (issue #188)', () => {
  const src = read('features/couple/website/WeddingWebsiteSetup.tsx')

  it('renders the create-error container as an ARIA alert live region', () => {
    // Failed site creation must be announced to screen readers.
    expect(src).toMatch(/role="alert"[^>]*text-red-700|text-red-700[^>]*role="alert"/)
  })

  it('tracks a slugTouched flag set on manual slug edits', () => {
    expect(src).toContain('slugTouched')
    expect(src).toContain('setSlugTouched(true)')
  })

  it('routes name-field edits through the touch-aware slug decision', () => {
    expect(src).toContain('slugAfterNameChange(slugTouched')
  })
})
