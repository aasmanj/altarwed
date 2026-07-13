import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { safeFontTheme, readFontThemeKey, FONT_THEME_KEYS, FONT_THEME_STORAGE_KEY } from './safeFontTheme'

// Issue #358: font-pairing themes. The couple's choice is persisted inside the opaque
// customTabLabels JSON column under the reserved __theme key (no new DB column/migration),
// and the public wedding layout maps it to allowlisted heading/body font stacks.
describe('safeFontTheme (issue #358)', () => {
  it('defaults to the classic Playfair/Inter pair when unset', () => {
    const pair = safeFontTheme(null)
    expect(pair.heading).toContain('--font-playfair')
    expect(pair.body).toContain('--font-inter')
  })

  it('treats empty string, malformed JSON, and non-objects as unset (classic)', () => {
    for (const input of ['', 'not json', '[]', 'null', '"x"'] as const) {
      const pair = safeFontTheme(input)
      expect(pair.heading).toContain('--font-playfair')
      expect(pair.body).toContain('--font-inter')
    }
  })

  it('maps each known theme key to its distinct heading/body stacks', () => {
    const modern = safeFontTheme(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'modern' }))
    expect(modern.heading).toContain('--font-montserrat')
    expect(modern.body).toContain('--font-inter')

    const editorial = safeFontTheme(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'editorial' }))
    expect(editorial.heading).toContain('--font-cormorant')
    expect(editorial.body).toContain('--font-lato')

    const romantic = safeFontTheme(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'romantic' }))
    expect(romantic.heading).toContain('--font-dancing-script')
    expect(romantic.body).toContain('--font-lato')
  })

  it('reads the theme key alongside real tab labels without confusing them', () => {
    // This is exactly the shape the dashboard writes: reserved key + tab labels together.
    const stored = JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'modern', TRAVEL: 'Hotels & flights' })
    expect(readFontThemeKey(stored)).toBe('modern')
    expect(safeFontTheme(stored).heading).toContain('--font-montserrat')
  })

  it('falls back to classic for an unknown or hostile theme key', () => {
    expect(readFontThemeKey(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'bogus' }))).toBeNull()
    // Prototype-chain keys must never leak into the <style> sink.
    expect(readFontThemeKey(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'toString' }))).toBeNull()
    const pair = safeFontTheme(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'bogus' }))
    expect(pair.heading).toContain('--font-playfair')
  })

  it('exposes the four curated theme keys', () => {
    expect(FONT_THEME_KEYS).toEqual(['classic', 'modern', 'editorial', 'romantic'])
  })
})

// Source-level guard that the render path actually consumes the theme. vitest runs in a
// plain node env here, so (as with accentColorWiring.test.ts) we assert on the file markup
// rather than rendering the Next.js server component.
describe('font-theme render wiring (issue #358)', () => {
  const layout = readFileSync(
    path.join(process.cwd(), 'src', 'app', 'wedding', '[slug]', 'layout.tsx'),
    'utf8',
  )
  const preview = readFileSync(
    path.join(process.cwd(), 'src', 'app', 'preview', '[slug]', '[tab]', 'page.tsx'),
    'utf8',
  )

  it.each([['layout.tsx', layout], ['preview page.tsx', preview]])(
    '%s derives the theme from customTabLabels and emits the font vars',
    (_name, src) => {
      expect(src).toContain('safeFontTheme(wedding.customTabLabels)')
      expect(src).toContain('--heading-font:')
      expect(src).toContain('--body-font:')
      // Headings inside the wedding layout must consume the heading var.
      expect(src).toContain('.aw-fonts h1')
      expect(src).toContain('font-family: var(--heading-font)')
    },
  )

  it('loads the new pairing faces via next/font in the root layout', () => {
    const root = readFileSync(path.join(process.cwd(), 'src', 'app', 'layout.tsx'), 'utf8')
    expect(root).toContain('Cormorant_Garamond')
    expect(root).toContain('Lato')
    expect(root).toContain('--font-cormorant')
    expect(root).toContain('--font-lato')
  })
})
