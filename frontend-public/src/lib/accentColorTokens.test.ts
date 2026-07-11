import { describe, it, expect } from 'vitest'
import { relativeLuminance, contrastRatio, accentColorTokens } from './accentColorTokens'

const DARK_SURFACE = '#3b2f2f'
const LIGHT_SURFACE = '#fdfaf6'
const AA = 4.5

describe('relativeLuminance', () => {
  it('is 0 for black and ~1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
  it('expands shorthand hex and ignores alpha', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 5)
    expect(relativeLuminance('#ffffff80')).toBeCloseTo(relativeLuminance('#ffffff'), 5)
  })
})

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5)
  })
  it('is order-independent', () => {
    expect(contrastRatio('#3b2f2f', '#d4af6a')).toBeCloseTo(contrastRatio('#d4af6a', '#3b2f2f'), 6)
  })
})

describe('fallback colors are themselves AA-legible on their surface', () => {
  // If these ever regress, the whole guard is unsound, so assert them directly.
  it('gold fallback passes on the dark panel', () => {
    expect(contrastRatio('#d4af6a', DARK_SURFACE)).toBeGreaterThanOrEqual(AA)
  })
  it('deep-brown fallback passes on the light page', () => {
    expect(contrastRatio('#6b5344', LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA)
  })
})

describe('accentColorTokens picks readable colors for every preset', () => {
  // The curated palette from the dashboard (accentPresets), plus the default.
  const PRESETS = ['#d4af6a', '#9caf88', '#7c92a8', '#dda6a6', '#7b2d3a', '#4a5568', '#6b4a5e', '#2f4a3a']

  it('onDark is always AA-legible on the dark panel', () => {
    for (const p of PRESETS) {
      expect(contrastRatio(accentColorTokens(p).onDark, DARK_SURFACE)).toBeGreaterThanOrEqual(AA)
    }
  })
  it('onLight is always AA-legible on the light page', () => {
    for (const p of PRESETS) {
      expect(contrastRatio(accentColorTokens(p).onLight, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA)
    }
  })
  it('onAccent (bold CTA label) always clears AA-large (3:1) on the accent fill', () => {
    // CTA labels are bold, so AA-large (3:1) is the applicable threshold, not 4.5. The worst case
    // for any accent with a white-or-dark-brown label is ~4:1, comfortably above 3:1 -- and far
    // above the ~1.3:1 dark-on-dark failure this guard replaces.
    const AA_LARGE = 3
    for (const p of PRESETS) {
      const { onAccent } = accentColorTokens(p)
      expect(contrastRatio(onAccent, p)).toBeGreaterThanOrEqual(AA_LARGE)
    }
  })

  it('keeps the accent as text when it is already legible, substitutes when not', () => {
    // A dark accent (burgundy) fails on the dark panel -> falls back to gold; passes on light -> kept.
    const burgundy = accentColorTokens('#7b2d3a')
    expect(burgundy.onDark).toBe('#d4af6a')
    expect(burgundy.onLight).toBe('#7b2d3a')
    // A pale accent (blush) passes on the dark panel -> kept; fails on light -> falls back to brown.
    const blush = accentColorTokens('#dda6a6')
    expect(blush.onDark).toBe('#dda6a6')
    expect(blush.onLight).toBe('#6b5344')
    // A dark accent gets a white button label; a pale accent gets a dark button label.
    expect(accentColorTokens('#7b2d3a').onAccent).toBe('#ffffff')
    expect(accentColorTokens('#dda6a6').onAccent).toBe('#3b2f2f')
  })
})
