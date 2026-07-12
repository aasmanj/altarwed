import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FONT_THEME,
  FONT_THEME_OPTIONS,
  FONT_THEME_STORAGE_KEY,
  parseTabLabels,
  readFontThemeKey,
  serializeTabLabels,
} from './fontThemes'

// Issue #358: the font-pairing theme is persisted inside the existing opaque
// customTabLabels JSON column (no new backend column/migration), sharing the field with
// the tab-label map. These tests pin the two invariants that make that safe:
//   1. selecting a theme round-trips (persist proof), and
//   2. theme and tab labels never clobber each other in the shared column.
describe('fontThemes storage (issue #358)', () => {
  it('defaults to classic when the column is empty/absent/malformed', () => {
    expect(readFontThemeKey(null)).toBe(DEFAULT_FONT_THEME)
    expect(readFontThemeKey('')).toBe(DEFAULT_FONT_THEME)
    expect(readFontThemeKey('not json')).toBe(DEFAULT_FONT_THEME)
    expect(readFontThemeKey(JSON.stringify({ [FONT_THEME_STORAGE_KEY]: 'bogus' }))).toBe(DEFAULT_FONT_THEME)
  })

  it('persists a selected theme and reads it back (round trip)', () => {
    for (const option of FONT_THEME_OPTIONS) {
      const serialized = serializeTabLabels({}, option.key)
      expect(readFontThemeKey(serialized)).toBe(option.key)
    }
  })

  it('stores nothing for the default theme so an unset site stays clean', () => {
    expect(serializeTabLabels({}, 'classic')).toBe('')
    expect(serializeTabLabels({}, 'classic')).not.toContain(FONT_THEME_STORAGE_KEY)
  })

  it('keeps tab labels and the theme independent in the shared column', () => {
    // Save labels + a theme.
    const serialized = serializeTabLabels({ TRAVEL: 'Hotels & flights' }, 'editorial')
    // Both survive.
    expect(readFontThemeKey(serialized)).toBe('editorial')
    expect(parseTabLabels(serialized)).toEqual({ TRAVEL: 'Hotels & flights' })
    // parseTabLabels never surfaces the reserved key as if it were a tab label.
    expect(parseTabLabels(serialized)).not.toHaveProperty(FONT_THEME_STORAGE_KEY)
  })

  it('re-saving tab labels preserves a previously chosen theme', () => {
    const first = serializeTabLabels({}, 'modern')
    // Editor reopens: it parses labels (theme stripped) and reads the theme separately,
    // then re-serializes with both. The theme must not be lost.
    const labels = parseTabLabels(first)
    const theme = readFontThemeKey(first)
    const second = serializeTabLabels({ ...labels, REGISTRY: 'Gifts' }, theme)
    expect(readFontThemeKey(second)).toBe('modern')
    expect(parseTabLabels(second)).toEqual({ REGISTRY: 'Gifts' })
  })

  it('changing the theme back to default clears the reserved key but keeps labels', () => {
    const withTheme = serializeTabLabels({ TRAVEL: 'Trips' }, 'romantic')
    const reset = serializeTabLabels(parseTabLabels(withTheme), 'classic')
    expect(readFontThemeKey(reset)).toBe('classic')
    expect(reset).not.toContain(FONT_THEME_STORAGE_KEY)
    expect(parseTabLabels(reset)).toEqual({ TRAVEL: 'Trips' })
  })
})
