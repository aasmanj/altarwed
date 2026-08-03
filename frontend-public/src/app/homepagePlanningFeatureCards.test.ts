import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #552: the two differentiating high-touch planning
// features (drag-and-drop seating chart with a printable board, and save-the-dates /
// invitations sent as real printed mail) were unsold on the homepage. vitest runs in
// a node environment here (no jsdom), matching the sibling public tests, so we assert
// on the load-bearing feature-card copy rather than rendering. Each assertion fails on
// the pre-fix source and passes after.
const page = readFileSync(path.join(process.cwd(), 'src', 'app', 'page.tsx'), 'utf8')

describe('homepage planning feature cards (issue #552)', () => {
  it('adds a first-class seating chart card with honest drag-and-drop + printable copy', () => {
    expect(page).toContain("title: 'Seating Chart Builder'")
    expect(page).toContain('drag and drop')
    expect(page).toContain('print')
  })

  it('adds a first-class stationery card that is honest about real printed mail', () => {
    expect(page).toContain("title: 'Save-the-Dates & Invitations'")
    expect(page).toContain('real printed mail')
  })

  it('stops burying seating as a clause inside the Guest List & RSVP card', () => {
    // The old RSVP card ended "...track meal preferences, and coordinate seating."
    // Seating now has its own card, so that trailing clause must be gone.
    expect(page).not.toContain('track meal preferences, and coordinate seating')
  })

  it('keeps the primary keyword present in the new planning copy', () => {
    expect(page).toContain('Christian wedding planning')
  })

  it('uses no em dashes in the homepage copy', () => {
    expect(page).not.toContain('—')
  })
})
