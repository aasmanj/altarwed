import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for RSVP discoverability on the public wedding HOME page.
// vitest runs here in a plain node environment (no jsdom / testing-library), so
// rather than render the components we assert on the load-bearing markup of the
// two files involved:
//   - the standalone gold RSVP pill added for issue #104 was removed as a
//     redundant third RSVP entry point (nav tab + Explore card already cover it);
//     guard against it silently reappearing above the tab content.
//   - the sticky wedding nav still lists RSVP second (right after Home), not
//     last, so it stays reachable near the start of the horizontally-scrolling
//     mobile nav -- this is the part of #104 that's still load-bearing.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('Public RSVP discoverability on mobile (issue #104, revised)', () => {
  it('wedding HOME page does not render the standalone RSVP pill above the tab content', () => {
    const src = read('app/wedding/[slug]/page.tsx')
    // The pill's distinctive gold-on-brown markup (WCAG AA 6.2:1) must not
    // reappear above TabBlocks -- RSVP discoverability now relies solely on the
    // nav tab and the Explore card, both asserted elsewhere.
    expect(src).not.toContain('bg-[#d4af6a] text-[#3b2f2f]')
    expect(src).not.toContain('w-full sm:w-auto')
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
