import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #104 (public RSVP hard to find on mobile). As with
// the issue #69 RSVP UX tests, vitest runs here in a plain node environment (no
// jsdom / testing-library), so rather than render the components we assert on the
// load-bearing markup of the two files the fix touches. Each assertion fails on the
// pre-fix source and passes after, which is the behavioral contract for these
// markup-only changes:
//   - the wedding HOME page renders a high-contrast RSVP button ABOVE the tab
//     content, so it shows whether the couple uses the scalar template OR the block
//     editor (a fully-filled site, the exact case the issue describes, uses blocks)
//   - the sticky wedding nav lists RSVP second (right after Home), not last, so it
//     stays reachable near the start of the horizontally-scrolling mobile nav
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('Public RSVP discoverability on mobile (issue #104)', () => {
  it('wedding HOME page renders a high-contrast RSVP CTA above the tab content', () => {
    const src = read('app/wedding/[slug]/page.tsx')
    // Gold-on-brown (WCAG AA 6.2:1), a combination the page did not use before the
    // fix; the legacy Explore card is a bordered white tile, not this button.
    expect(src).toContain('bg-[#d4af6a] text-[#3b2f2f]')
    // Full width on mobile, inline on sm+, per the issue's mobile requirement.
    expect(src).toContain('w-full sm:w-auto')
    // It links to the couple's RSVP route as a real anchor (Next Link), not just
    // the data-driven Explore card.
    expect(src).toContain('href={`${base}/rsvp`}')
    // It must render ABOVE the tab content, otherwise a block-editor couple would
    // never see it (TabBlocks renders custom blocks in place of the fallback).
    const ctaIndex = src.indexOf('bg-[#d4af6a] text-[#3b2f2f]')
    const tabBlocksIndex = src.indexOf('<TabBlocks')
    expect(ctaIndex).toBeGreaterThan(-1)
    expect(tabBlocksIndex).toBeGreaterThan(-1)
    expect(ctaIndex).toBeLessThan(tabBlocksIndex)
    // A visible focus ring keeps it keyboard-accessible (focus:outline-none alone
    // would strip the indicator, which the a11y rules forbid).
    expect(src).toContain('focus-visible:ring')
  })

  it('sticky nav lists RSVP second, right after Home, and keeps every tab', () => {
    const src = read('app/wedding/[slug]/WeddingNav.tsx')
    const homeIndex = src.indexOf("tab: 'HOME'")
    const rsvpIndex = src.indexOf("tab: 'RSVP'")
    const storyIndex = src.indexOf("tab: 'OUR_STORY'")
    // RSVP sits between HOME and OUR_STORY in the tabs array (it was last before).
    expect(homeIndex).toBeGreaterThan(-1)
    expect(rsvpIndex).toBeGreaterThan(homeIndex)
    expect(rsvpIndex).toBeLessThan(storyIndex)
    // All eight tabs still render, so the reorder drops nothing.
    for (const tab of [
      'HOME', 'RSVP', 'OUR_STORY', 'DETAILS',
      'WEDDING_PARTY', 'TRAVEL', 'REGISTRY', 'PHOTOS',
    ]) {
      expect(src).toContain(`tab: '${tab}'`)
    }
  })
})
