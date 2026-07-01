import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level WCAG contrast guard for issue #146 (frontend-app half). White text
// on the brand gold background fails WCAG 1.4.3 (AA needs 4.5:1); the dashboard CTA
// buttons measured 2.29:1. vitest runs here in a plain node environment (no jsdom /
// testing-library), so rather than render the components we assert on the load-bearing
// className strings the fix touches, plus we compute the real contrast ratios so the
// 4.5:1 acceptance criterion is verified numerically, not just by string match.
//
// Each assertion fails on the pre-fix source (text-white on gold) and passes after
// (text-brown on gold), which is the behavioral contract for these class-only changes.

// Palette resolved from tailwind.config.ts (frontend-app).
const GOLD = '#C9A84C' // bg-gold DEFAULT
const GOLD_LITERAL = '#d4af6a' // bg-[#d4af6a] used by the share-link chip
const BROWN = '#3D2B1F' // text-brown DEFAULT (the compliant dark text)
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

// Every gold CTA the issue lists across frontend-app.
const LISTED_FILES = [
  'features/auth/LoginPage.tsx',
  'features/auth/RegisterPage.tsx',
  'features/couple/guests/GuestListPage.tsx',
  'features/couple/budget/BudgetPage.tsx',
  'features/couple/checklist/ChecklistPage.tsx',
  'features/couple/guests/CustomQuestionsManager.tsx',
  'features/couple/guests/ImportGuestsModal.tsx',
  'components/QueryErrorState.tsx',
  'features/couple/website/ShareModal.tsx',
]

// Find every resting-state pairing of a solid gold background with white text within a
// single className. A className is a run of class characters and whitespace; it cannot
// cross a quote, brace, or angle bracket, so this regex never bridges two elements.
// The lookbehind excludes variant-prefixed gold (hover:bg-gold, a transient state, not
// resting) and the lookaheads exclude bg-gold-dark / bg-gold-light / bg-gold/5 and the
// bg-[#d4af6a]/10 opacity forms, none of which are the solid CTA background.
function goldWhitePairings(src: string): string[] {
  const re =
    /(?<![\w:-])(?:bg-gold|bg-\[#d4af6a\])(?![\w/-])[\w\-[\]#/:.\s]*?text-white|text-white[\w\-[\]#/:.\s]*?(?<![\w:-])(?:bg-gold|bg-\[#d4af6a\])(?![\w/-])/g
  return src.match(re) ?? []
}

describe('gold CTA contrast #146 (frontend-app)', () => {
  it('white text on the brand gold fails AA, so it was the correct thing to remove', () => {
    // Documents the measured failure the issue cites (~2.29:1 on the dashboard).
    expect(contrast(WHITE, GOLD)).toBeLessThan(4.5)
    expect(contrast(WHITE, GOLD_LITERAL)).toBeLessThan(4.5)
  })

  it('the compliant dark brown text clears AA 4.5:1 on both gold surfaces', () => {
    expect(contrast(BROWN, GOLD)).toBeGreaterThanOrEqual(4.5)
    // The share chip uses the #d4af6a literal with #3b2f2f brown text.
    expect(contrast('#3b2f2f', GOLD_LITERAL)).toBeGreaterThanOrEqual(4.5)
  })

  it('no listed gold CTA button pairs a gold background with white text', () => {
    const offenders: string[] = []
    for (const rel of LISTED_FILES) {
      for (const hit of goldWhitePairings(read(rel))) {
        offenders.push(`${rel}: ${hit.replace(/\s+/g, ' ').trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the RSVP-adjacent guest and checklist CTAs now carry brown text on gold', () => {
    // Spot-check the highest-traffic dashboard files actually adopted the fix rather
    // than merely dropping the text color.
    expect(read('features/couple/guests/GuestListPage.tsx')).toContain(
      'bg-gold px-3 py-2 text-sm font-semibold text-brown',
    )
    expect(read('features/couple/checklist/ChecklistPage.tsx')).toContain(
      "'bg-gold text-brown'",
    )
  })
})
