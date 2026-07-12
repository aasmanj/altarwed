import { describe, it, expect } from 'vitest'
import { safeNameFont, safeNameFontWeight, NAME_FONT_KEYS } from './safeFont'

describe('safeNameFont', () => {
  it('maps every allowlisted key to a font-family stack', () => {
    for (const key of NAME_FONT_KEYS) {
      const stack = safeNameFont(key)
      expect(stack).toContain('var(--font-')
    }
  })

  it('falls back to the Playfair default for null / undefined / unknown keys', () => {
    const dflt = safeNameFont('playfair')
    expect(safeNameFont(null)).toBe(dflt)
    expect(safeNameFont(undefined)).toBe(dflt)
    expect(safeNameFont('comic-sans')).toBe(dflt)
    expect(safeNameFont('')).toBe(dflt)
  })

  // Security guard: NAME_FONT_STACKS is a plain object, so a naive `map[key]` lookup would
  // return inherited Object.prototype members for these keys and leak them into the <style>
  // sink. Object.hasOwn must make them fall back to the default instead.
  it('rejects prototype-chain keys, returning the default', () => {
    const dflt = safeNameFont('playfair')
    for (const evil of ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']) {
      expect(safeNameFont(evil)).toBe(dflt)
      expect(typeof safeNameFont(evil)).toBe('string')
    }
  })
})

describe('safeNameFontWeight', () => {
  it('renders the single-weight script face at 400 (no faux-bold)', () => {
    expect(safeNameFontWeight('greatvibes')).toBe('400')
  })

  it('uses bold for the multi-weight families and the default', () => {
    expect(safeNameFontWeight('playfair')).toBe('700')
    expect(safeNameFontWeight('cinzel')).toBe('700')
    expect(safeNameFontWeight('dancingscript')).toBe('700')
    expect(safeNameFontWeight(null)).toBe('700')
    expect(safeNameFontWeight('__proto__')).toBe('700')
  })
})
