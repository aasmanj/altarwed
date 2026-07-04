import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #236: informational text rendered in text-stone-400 (#a8a29e) sits at roughly 2.5:1 on
// white, below the WCAG 2.1 SC 1.4.3 minimum of 4.5:1 for normal-size body text. The fix bumps
// every INFORMATIONAL stone-400 usage on these couple-facing screens to stone-500 (#78716c),
// which clears 4.5:1 on the white/cream card backgrounds these elements sit on. Decorative,
// aria-hidden icons are exempt (1.4.3 governs text, not glyphs).
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library), so the contract
// is verified two ways, matching printOrderPaymentGate.test.ts --
//   1. a pure WCAG contrast-ratio helper proving stone-400 fails and stone-500 passes 4.5:1
//   2. source-level assertions that the two components no longer paint text in stone-400.

const STONE_400 = '#a8a29e'
const STONE_500 = '#78716c'
const WHITE = '#ffffff'
const WCAG_AA_NORMAL = 4.5

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

function stone400Lines(src: string): string[] {
  return src.split('\n').filter((line) => line.includes('text-stone-400'))
}

describe('WCAG 1.4.3 contrast math (issue #236)', () => {
  it('confirms the old stone-400 informational text failed 4.5:1 on white', () => {
    expect(contrastRatio(STONE_400, WHITE)).toBeLessThan(WCAG_AA_NORMAL)
  })

  it('confirms the chosen stone-500 replacement passes 4.5:1 on white', () => {
    expect(contrastRatio(STONE_500, WHITE)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })
})

describe('CommunicationsPage informational text contrast (issue #236)', () => {
  const src = read('features/couple/communications/CommunicationsPage.tsx')

  it('paints no text in stone-400 (every usage there was informational)', () => {
    expect(stone400Lines(src)).toEqual([])
  })
})

describe('SaveTheDatePage informational text contrast (issue #236)', () => {
  const src = read('features/couple/savethedate/SaveTheDatePage.tsx')

  it('keeps stone-400 only on the decorative, aria-hidden upload icon', () => {
    const remaining = stone400Lines(src)
    // The single allowed survivor is the upload-cloud glyph, exempt from 1.4.3.
    expect(remaining).toHaveLength(1)
    for (const line of remaining) {
      expect(line).toContain('<svg')
      expect(line).toContain('aria-hidden="true"')
    }
  })
})
