import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level accessibility guard for issue #112 (frontend-public half). vitest
// runs in a node environment here (no jsdom / testing-library), so we assert on
// the load-bearing JSX rather than rendering. The guest-facing RSVP form is the
// billboard surface, so emoji-as-icons are swapped for Lucide icons for visual
// consistency and predictable screen-reader behaviour. Each assertion fails on
// the pre-fix source and passes after.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('RSVP form icon a11y #112', () => {
  const src = read('app/rsvp/[token]/RsvpForm.tsx')

  it('imports Lucide icons instead of relying on emoji glyphs', () => {
    expect(src).toContain("from 'lucide-react'")
    expect(src).toContain('PartyPopper')
    expect(src).toContain('Check')
    expect(src).toContain('X')
  })

  it('renders the status buttons with Lucide icon components, not emoji strings', () => {
    expect(src).toContain('{ value: \'ATTENDING\' as Status, label: \'Attending\', Icon: Check }')
    expect(src).toContain('{ value: \'DECLINING\' as Status, label: \'Declining\', Icon: X }')
    expect(src).toContain('<opt.Icon')
  })

  it('drops the emoji glyphs from the form entirely', () => {
    // The confirmation and status glyphs must be gone from the source.
    for (const glyph of ['🎉', '⏰', '💌', '✓', '✗']) {
      expect(src).not.toContain(glyph)
    }
  })
})
