import { describe, it, expect } from 'vitest'
import { ACCENT_PRESETS, isAccentPresetSelected } from './accentPresets'

// Issue #357: curated accent-color swatches above the custom picker. These tests
// pin the behavioral core (the preset list and the selected-state comparison)
// so the wiring cannot silently regress: an empty or clashing palette, an
// uppercase-vs-lowercase mismatch that leaves no swatch highlighted, or a
// dropped brand color would all fail here.
describe('accent palette presets (issue #357)', () => {
  it('offers 6 to 8 curated swatches', () => {
    expect(ACCENT_PRESETS.length).toBeGreaterThanOrEqual(6)
    expect(ACCENT_PRESETS.length).toBeLessThanOrEqual(8)
  })

  it('includes the named faith-first palette anchors', () => {
    const names = ACCENT_PRESETS.map(p => p.name)
    for (const expected of ['Gold', 'Sage', 'Dusty blue', 'Blush', 'Burgundy', 'Slate']) {
      expect(names).toContain(expected)
    }
  })

  it('keeps the default gold (#d4af6a) so the picker Reset stays on-palette', () => {
    expect(ACCENT_PRESETS.map(p => p.hex)).toContain('#d4af6a')
  })

  it('uses valid lowercase 6-digit hex for every swatch', () => {
    for (const preset of ACCENT_PRESETS) {
      expect(preset.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('has no duplicate hex values', () => {
    const hexes = ACCENT_PRESETS.map(p => p.hex)
    expect(new Set(hexes).size).toBe(hexes.length)
  })
})

describe('isAccentPresetSelected (issue #357)', () => {
  it('marks the swatch that matches the current accent', () => {
    expect(isAccentPresetSelected('#d4af6a', '#d4af6a')).toBe(true)
  })

  it('does not mark swatches the accent does not match', () => {
    expect(isAccentPresetSelected('#d4af6a', '#9caf88')).toBe(false)
  })

  it('matches case-insensitively so an uppercase saved hex still highlights', () => {
    expect(isAccentPresetSelected('#D4AF6A', '#d4af6a')).toBe(true)
  })

  it('treats a null or empty accent as nothing selected', () => {
    expect(isAccentPresetSelected(null, '#d4af6a')).toBe(false)
    expect(isAccentPresetSelected(undefined, '#d4af6a')).toBe(false)
    expect(isAccentPresetSelected('', '#d4af6a')).toBe(false)
  })
})
