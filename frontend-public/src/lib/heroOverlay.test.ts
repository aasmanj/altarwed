import { describe, it, expect } from 'vitest'
import {
  safeHeroOverlayDarkness,
  safeHeroOverlayGradient,
  safeHeroLayout,
  DEFAULT_HERO_OVERLAY_DARKNESS,
} from './heroOverlay'

// Issue #360: couple-selectable hero scrim intensity + full/framed fill mode. Both flow into
// a style sink on the public wedding hero, so the render helpers must clamp/allowlist before
// producing CSS. These tests pin the sanitisation and the default (unset = pre-#360 look).
describe('safeHeroOverlayDarkness (issue #360)', () => {
  it('defaults to 70 when unset (null / undefined)', () => {
    expect(safeHeroOverlayDarkness(null)).toBe(DEFAULT_HERO_OVERLAY_DARKNESS)
    expect(safeHeroOverlayDarkness(undefined)).toBe(70)
  })

  it('passes through an in-range value', () => {
    expect(safeHeroOverlayDarkness(0)).toBe(0)
    expect(safeHeroOverlayDarkness(45)).toBe(45)
    expect(safeHeroOverlayDarkness(100)).toBe(100)
  })

  it('clamps out-of-range values to 0..100 (defence in depth over the backend @Min/@Max)', () => {
    expect(safeHeroOverlayDarkness(-40)).toBe(0)
    expect(safeHeroOverlayDarkness(9999)).toBe(100)
  })

  it('rounds fractional values and rejects NaN', () => {
    expect(safeHeroOverlayDarkness(62.4)).toBe(62)
    expect(safeHeroOverlayDarkness(Number.NaN)).toBe(70)
  })
})

describe('safeHeroOverlayGradient (issue #360)', () => {
  it('reproduces the pre-#360 gradient exactly at the default darkness', () => {
    // Original hero used `from-black/70 via-black/20 to-black/10` (to top). Darkness 70 must
    // regenerate those three alpha stops so an unset site is pixel-identical.
    const g = safeHeroOverlayGradient(null)
    expect(g).toBe(
      'linear-gradient(to top, rgba(0,0,0,0.700) 0%, rgba(0,0,0,0.200) 50%, rgba(0,0,0,0.100) 100%)',
    )
  })

  it('darkens visibly at a higher value and lightens at a lower one', () => {
    // The bottom stop (index 0%) is the load-bearing scrim behind the white names.
    expect(safeHeroOverlayGradient(100)).toContain('rgba(0,0,0,1.000) 0%')
    expect(safeHeroOverlayGradient(0)).toContain('rgba(0,0,0,0.000) 0%')
  })

  it('never interpolates a raw value into the gradient (clamps first)', () => {
    // A crafted out-of-range PATCH that slipped past the backend still cannot inject CSS.
    const g = safeHeroOverlayGradient(999999)
    expect(g).toContain('rgba(0,0,0,1.000) 0%')
    expect(g).not.toContain('999999')
  })
})

describe('safeHeroLayout (issue #360)', () => {
  it('defaults to "full" when unset or unknown', () => {
    expect(safeHeroLayout(null)).toBe('full')
    expect(safeHeroLayout(undefined)).toBe('full')
    expect(safeHeroLayout('')).toBe('full')
    expect(safeHeroLayout('gallery')).toBe('full')
  })

  it('accepts the allowlisted keys, including names-below (issue #457)', () => {
    expect(safeHeroLayout('full')).toBe('full')
    expect(safeHeroLayout('framed')).toBe('framed')
    expect(safeHeroLayout('names-below')).toBe('names-below')
  })

  it('falls back to "full" for invalid or null input (issue #457)', () => {
    expect(safeHeroLayout('invalid')).toBe('full')
    expect(safeHeroLayout(null)).toBe('full')
  })

  it('does not leak a hostile string through', () => {
    expect(safeHeroLayout('"></style><script>')).toBe('full')
  })
})
