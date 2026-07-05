import { describe, it, expect } from 'vitest'
import { safeColor } from '@/lib/safeColor'

// safeColor guards accentColor, heroTaglineColor, and scriptureBackgroundColor
// before they reach a style sink on the public and preview wedding pages.
describe('safeColor', () => {
  it('passes valid hex colors through unchanged', () => {
    expect(safeColor('#fff', '#d4af6a')).toBe('#fff')
    expect(safeColor('#FFFFFF', '#d4af6a')).toBe('#FFFFFF')
    expect(safeColor('#1a2b3c', '#d4af6a')).toBe('#1a2b3c')
    // 8-digit hex with alpha channel is valid.
    expect(safeColor('#1a2b3c80', '#d4af6a')).toBe('#1a2b3c80')
  })

  it('falls back for null and undefined', () => {
    expect(safeColor(null, '#d4af6a')).toBe('#d4af6a')
    expect(safeColor(undefined, '#d4af6a')).toBe('#d4af6a')
  })

  it('falls back for empty and non-hex strings', () => {
    expect(safeColor('', '#d4af6a')).toBe('#d4af6a')
    expect(safeColor('red', '#d4af6a')).toBe('#d4af6a')
    expect(safeColor('rgb(0,0,0)', '#d4af6a')).toBe('#d4af6a')
    // Missing leading hash.
    expect(safeColor('ffffff', '#d4af6a')).toBe('#d4af6a')
    // Too long to be a color; the original accentColor regex capped at 8 digits.
    expect(safeColor('#0123456789', '#d4af6a')).toBe('#d4af6a')
  })

  it('rejects style-breakout attempts and CSS injection payloads', () => {
    expect(safeColor('#fff;background:url(javascript:alert(1))', '#d4af6a')).toBe('#d4af6a')
    expect(safeColor('red;} body { display:none', '#d4af6a')).toBe('#d4af6a')
    expect(safeColor('</style><script>alert(1)</script>', '#d4af6a')).toBe('#d4af6a')
  })

  it('returns an undefined fallback so optional colors trigger the CSS default', () => {
    // scriptureBackgroundColor uses undefined to fall back to a gradient class.
    expect(safeColor(null, undefined)).toBeUndefined()
    expect(safeColor('not-a-color', undefined)).toBeUndefined()
    expect(safeColor('#3b2f2f', undefined)).toBe('#3b2f2f')
  })
})
