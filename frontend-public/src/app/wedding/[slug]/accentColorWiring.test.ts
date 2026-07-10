import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guards for issue #349: the couple's accentColor picker must
// actually recolor the public wedding site. layout.tsx emits
//   <style>:root { --accent: <color> }</style>
// only for published couples, so every gold accent that renders INSIDE that
// layout must consume var(--accent) instead of the hardcoded #d4af6a literal.
// vitest runs in a plain node environment here, so rather than render the
// pages we assert on the Tailwind class markup of the files involved.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', 'app', 'wedding', '[slug]', rel), 'utf8')
}

// Pages/components that render inside the layout where --accent is defined.
// Their gold accents MUST be var-driven so the picker goes live.
const CONVERTED = [
  'layout.tsx',
  'page.tsx',
  'story/page.tsx',
  'details/page.tsx',
  'travel/page.tsx',
  'rsvp/page.tsx',
  'rsvp/FindInvitationWidget.tsx',
  'registry/page.tsx',
  'wedding-party/page.tsx',
  'photos/page.tsx',
  'photos/PhotoGalleryClient.tsx',
  'WeddingNav.tsx',
]

// Screens that render BEFORE line 155 of layout.tsx (notFound / ComingSoon) or
// outside the [slug] layout entirely, so --accent is not defined and they must
// keep the literal AltarWed gold.
const NOT_CONVERTED = [
  'not-found.tsx',
  'ComingSoon.tsx',
]

describe('Accent-color picker wiring on the public wedding site (issue #349)', () => {
  it.each(CONVERTED)('%s has no dead #d4af6a Tailwind literal', (rel) => {
    const src = read(rel)
    // A [#d4af6a] arbitrary value would ignore --accent and leave the picker
    // dead for that class. None may remain on a converted file.
    expect(src).not.toContain('[#d4af6a]')
  })

  it.each(CONVERTED)('%s consumes var(--accent)', (rel) => {
    const src = read(rel)
    expect(src).toContain('var(--accent)')
  })

  it('opacity accents use color-mix, never the alpha-dropping var form', () => {
    // Tailwind cannot apply a /opacity modifier to a CSS-var arbitrary value,
    // so bg-[var(--accent)]/40 would silently render fully opaque. The dividers
    // and scripture rules must use color-mix instead.
    for (const rel of CONVERTED) {
      const src = read(rel)
      expect(src).not.toMatch(/\[var\(--accent\)\]\/\d/)
    }
  })

  it('layout.tsx keeps #d4af6a as the safeColor default so unset accent is unchanged', () => {
    // var(--accent) resolves to this default when the couple has not picked a
    // color, which keeps today's gold sites pixel-identical.
    expect(read('layout.tsx')).toContain("safeColor(wedding.accentColor, '#d4af6a')")
  })

  it.each(NOT_CONVERTED)('%s keeps the literal gold (renders without --accent)', (rel) => {
    expect(read(rel)).toContain('#d4af6a')
  })
})
