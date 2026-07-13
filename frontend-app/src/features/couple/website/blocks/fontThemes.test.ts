import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FONT_THEME,
  FONT_THEME_OPTIONS,
  FONT_THEME_STORAGE_KEY,
  parseTabLabels,
  readFontThemeKey,
  serializeTabLabels,
  withFontTheme,
  withTabLabels,
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

// Issue #359: the font theme is now edited in the Design panel while the tab labels stay in
// the Tabs panel, but both still write the single opaque customTabLabels column. withFontTheme
// (Design panel writer) and withTabLabels (Tabs panel writer) are the two slice-preserving
// writers. These tests pin that the two panels never clobber each other's slice, which is the
// whole persistence contract for the split.
describe('design/tabs split writers (issue #359)', () => {
  it('withFontTheme changes only the theme and round-trips', () => {
    for (const option of FONT_THEME_OPTIONS) {
      const serialized = withFontTheme(null, option.key)
      expect(readFontThemeKey(serialized)).toBe(option.key)
    }
  })

  it('withFontTheme preserves any tab labels already stored', () => {
    // Tabs panel saved a custom label first.
    const afterLabels = withTabLabels(null, { TRAVEL: 'Hotels & flights' })
    // Design panel then picks a theme.
    const afterTheme = withFontTheme(afterLabels, 'editorial')
    expect(readFontThemeKey(afterTheme)).toBe('editorial')
    expect(parseTabLabels(afterTheme)).toEqual({ TRAVEL: 'Hotels & flights' })
  })

  it('withTabLabels preserves the theme the Design panel already chose', () => {
    // Design panel saved a theme first.
    const afterTheme = withFontTheme(null, 'modern')
    // Tabs panel then renames a tab.
    const afterLabels = withTabLabels(afterTheme, { REGISTRY: 'Gifts' })
    expect(readFontThemeKey(afterLabels)).toBe('modern')
    expect(parseTabLabels(afterLabels)).toEqual({ REGISTRY: 'Gifts' })
  })

  it('interleaved edits from both panels never clobber each other', () => {
    let column: string | null = null
    // Couple picks a theme in the Design panel.
    column = withFontTheme(column, 'romantic')
    // Renames a tab in the Tabs panel.
    column = withTabLabels(column, { TRAVEL: 'Getting there' })
    // Switches the theme again in the Design panel.
    column = withFontTheme(column, 'editorial')
    // Renames another tab in the Tabs panel.
    column = withTabLabels(column, { TRAVEL: 'Getting there', REGISTRY: 'Registry' })
    // Both slices survive the interleaving.
    expect(readFontThemeKey(column)).toBe('editorial')
    expect(parseTabLabels(column)).toEqual({ TRAVEL: 'Getting there', REGISTRY: 'Registry' })
  })

  it('resetting the theme to default via the Design panel keeps the labels clean', () => {
    const withBoth = withFontTheme(withTabLabels(null, { PHOTOS: 'Gallery' }), 'modern')
    const resetTheme = withFontTheme(withBoth, DEFAULT_FONT_THEME)
    expect(readFontThemeKey(resetTheme)).toBe(DEFAULT_FONT_THEME)
    expect(resetTheme).not.toContain(FONT_THEME_STORAGE_KEY)
    expect(parseTabLabels(resetTheme)).toEqual({ PHOTOS: 'Gallery' })
  })
})
