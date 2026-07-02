import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level WCAG contrast guard for issue #146 (frontend-public half). White text
// on the brand gold background fails WCAG 1.4.3 (AA needs 4.5:1); the public RSVP
// buttons measured 2.07:1. This mirrors the existing rsvpHeroCta.test.ts guard, which
// already treats "bg-[#d4af6a] text-[#3b2f2f]" as the compliant 6.2:1 combination.
//
// vitest runs here in a plain node environment (no jsdom / testing-library), so we
// assert on the load-bearing className strings the fix touches and compute the real
// contrast ratios. Each assertion fails on the pre-fix source (text-white on gold) and
// passes after (text-[#3b2f2f] on gold), the behavioral contract for these class-only
// changes.

const GOLD_LITERAL = '#d4af6a' // bg-[#d4af6a] used by the RSVP + vendor CTAs
const BROWN = '#3b2f2f' // the compliant dark brown already used by the persistent CTA
const WHITE = '#FFFFFF'

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  )
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Find every resting-state pairing of a solid gold background with white text within a
// single className. A className is a run of class characters and whitespace; it cannot
// cross a quote, brace, or angle bracket, so this regex never bridges two elements.
// The lookbehind excludes variant-prefixed gold (hover:bg-[#d4af6a], transient not
// resting) and the lookaheads exclude the bg-[#d4af6a]/10 opacity forms.
function goldWhitePairings(src: string): string[] {
  const re =
    /(?<![\w:-])bg-\[#d4af6a\](?![\w/-])[\w\-[\]#/:.\s]*?text-white|text-white[\w\-[\]#/:.\s]*?(?<![\w:-])bg-\[#d4af6a\](?![\w/-])/g
  return src.match(re) ?? []
}

describe('gold CTA contrast #146 (frontend-public)', () => {
  it('white on gold fails AA while the dark brown text clears 4.5:1', () => {
    // Documents the measured public-site failure (~2.07:1) the issue cites.
    expect(contrast(WHITE, GOLD_LITERAL)).toBeLessThan(4.5)
    expect(contrast(BROWN, GOLD_LITERAL)).toBeGreaterThanOrEqual(4.5)
  })

  it('the RSVP find/submit buttons no longer put white text on gold', () => {
    const src = read('app/wedding/[slug]/rsvp/FindInvitationWidget.tsx')
    expect(goldWhitePairings(src)).toEqual([])
    // Both the "Find Me" and "RSVP Now" buttons now carry the brown text.
    expect(src.match(/text-\[#3b2f2f\]/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('the homepage vendor CTA matches the compliant hero CTA styling', () => {
    const src = read('app/page.tsx')
    expect(goldWhitePairings(src)).toEqual([])
    // The "Claim your spot" CTA now uses gold + brown text, like the hero CTA.
    expect(src).toContain('bg-[#d4af6a] text-[#3b2f2f]')
  })
})
