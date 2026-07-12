import { describe, it, expect } from 'vitest'
import {
  composePrintTemplateKey,
  basePrintTemplateKey,
  isPhotoTemplate,
  styleOf,
  overlayPlacement,
  TEXT_POSITIONS,
  DEFAULT_TEXT_POSITION,
  DEFAULT_OVERLAY_THEME,
} from './printTemplate'

// Issue #362: the templateKey composition/parsing is the contract the frontend shares with the
// backend PrintTemplate allowlist, so it is unit-tested directly (vitest runs in node, no DOM).

describe('composePrintTemplateKey (issue #362)', () => {
  it('appends the chosen 3x3 position + light/dark theme onto a photo templateKey', () => {
    expect(composePrintTemplateKey('SAVE_THE_DATE_PHOTO', 'TOP_LEFT', 'DARK'))
      .toBe('SAVE_THE_DATE_PHOTO~TOP_LEFT~DARK')
    expect(composePrintTemplateKey('INVITATION_PHOTO', 'MIDDLE_RIGHT', 'LIGHT'))
      .toBe('INVITATION_PHOTO~MIDDLE_RIGHT~LIGHT')
  })

  it('sets exactly the position the picker chose, for every cell of the 3x3 grid', () => {
    for (const pos of TEXT_POSITIONS) {
      const key = composePrintTemplateKey('INVITATION_PHOTO', pos, 'LIGHT')
      expect(key).toBe(`INVITATION_PHOTO~${pos}~LIGHT`)
      // Round-trips: the base strips cleanly back off the composed key.
      expect(basePrintTemplateKey(key)).toBe('INVITATION_PHOTO')
    }
  })

  it('leaves a non-photo templateKey untouched (overlay is meaningless there)', () => {
    for (const base of ['SAVE_THE_DATE_CLASSIC', 'INVITATION_MINIMAL', 'SAVE_THE_DATE_BOTANICAL', 'INVITATION_DARK_ELEGANT'] as const) {
      expect(composePrintTemplateKey(base, 'TOP_LEFT', 'DARK')).toBe(base)
    }
  })

  it('a bare photo key composed with the defaults matches the proven original card', () => {
    expect(composePrintTemplateKey('SAVE_THE_DATE_PHOTO', DEFAULT_TEXT_POSITION, DEFAULT_OVERLAY_THEME))
      .toBe('SAVE_THE_DATE_PHOTO~BOTTOM_CENTER~LIGHT')
  })
})

describe('basePrintTemplateKey (issue #362)', () => {
  it('strips a suffix back to the base for labeling past orders', () => {
    expect(basePrintTemplateKey('INVITATION_PHOTO~BOTTOM_RIGHT~DARK')).toBe('INVITATION_PHOTO')
  })

  it('returns a base key with no suffix unchanged', () => {
    expect(basePrintTemplateKey('SAVE_THE_DATE_MINIMAL')).toBe('SAVE_THE_DATE_MINIMAL')
  })
})

describe('template helpers (issue #362)', () => {
  it('identifies photo templates', () => {
    expect(isPhotoTemplate('SAVE_THE_DATE_PHOTO')).toBe(true)
    expect(isPhotoTemplate('INVITATION_CLASSIC')).toBe(false)
    expect(isPhotoTemplate('INVITATION_DARK_ELEGANT')).toBe(false)
  })

  it('reads the style token off either order type', () => {
    expect(styleOf('SAVE_THE_DATE_DARK_ELEGANT')).toBe('DARK_ELEGANT')
    expect(styleOf('INVITATION_MINIMAL')).toBe('MINIMAL')
    expect(styleOf('SAVE_THE_DATE_BOTANICAL')).toBe('BOTANICAL')
  })
})

describe('overlayPlacement (issue #362)', () => {
  it('maps the vertical band to flex justify and the horizontal to align + textAlign', () => {
    expect(overlayPlacement('TOP_LEFT')).toEqual({ justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left' })
    expect(overlayPlacement('BOTTOM_CENTER')).toEqual({ justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' })
    expect(overlayPlacement('MIDDLE_RIGHT')).toEqual({ justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right' })
  })
})
