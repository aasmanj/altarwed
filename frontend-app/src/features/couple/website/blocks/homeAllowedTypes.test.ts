import { describe, it, expect } from 'vitest'
import { ALLOWED_TYPES_PER_TAB } from './types'

// Issue #329: the Home tab of the page-builder editor is trimmed to functional /
// venue blocks. The "Add block" picker reads ALLOWED_TYPES_PER_TAB.HOME, so pinning
// that list is the behavioral guard: it fails if a generic content primitive
// (HEADING / TEXT / SCRIPTURE / DIVIDER) creeps back onto the Home landing view, or
// if VENUE_CARD is dropped from the seeded default set.
describe('Home tab addable block types (issue #329)', () => {
  it('offers exactly Image, Venue card, Countdown, and RSVP CTA', () => {
    expect(ALLOWED_TYPES_PER_TAB.HOME).toEqual([
      'IMAGE',
      'VENUE_CARD',
      'COUNTDOWN',
      'RSVP_CTA',
    ])
  })

  it('no longer offers the generic content primitives on Home', () => {
    for (const dropped of ['HEADING', 'TEXT', 'SCRIPTURE', 'DIVIDER'] as const) {
      expect(ALLOWED_TYPES_PER_TAB.HOME).not.toContain(dropped)
    }
  })
})
