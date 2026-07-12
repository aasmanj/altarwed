// Contrast guard for the couple's accent color (issue #350).
//
// The couple picks one accent hex, but the public wedding site paints it on both the dark
// scripture/hero panels (#3b2f2f) and the light page background (#fdfaf6), AND uses it as a
// button fill with a text label on top. A single raw accent can't be readable in all three
// places: a dark accent (burgundy) becomes invisible as text on the dark panel and as a dark
// label on its own button; a pale accent (blush) becomes invisible as text on the cream page.
//
// So we derive per-surface tokens from the accent's WCAG relative luminance and emit them as CSS
// custom properties alongside --accent. Decorative fills/dividers keep using the raw --accent
// (contrast is not critical there); text and button labels use the readable token for their
// surface, which falls back to a guaranteed-legible warm gold (on dark) or deep brown (on light)
// when the accent itself would fail AA. This keeps the couple's color wherever it reads and only
// substitutes where it wouldn't.

// Surfaces the accent is painted against on the public wedding pages.
const DARK_SURFACE = '#3b2f2f'   // scripture banner + hero overlay text
const LIGHT_SURFACE = '#fdfaf6'  // page cream background

// Guaranteed-legible fallbacks (their own contrast on each surface is asserted in the tests).
const FALLBACK_ON_DARK = '#d4af6a'   // warm gold, the original site accent
const FALLBACK_ON_LIGHT = '#6b5344'  // deep brown, already used in the footer
const LIGHT_LABEL = '#ffffff'
const DARK_LABEL = '#3b2f2f'

// WCAG 2.1 AA for normal text. Large text (3:1) would be laxer, but holding everything to 4.5
// keeps the countdown numeral and small labels all safe with one threshold.
const AA_NORMAL = 4.5

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  // Expand shorthand #rgb / #rgba to full pairs; take the first 6 hex chars (ignore any alpha).
  if (h.length === 3 || h.length === 4) {
    h = h.slice(0, 3).split('').map(c => c + c).join('')
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

function channelLuminance(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** WCAG contrast ratio between two hex colors (1 = identical, 21 = black-on-white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

export interface AccentTokens {
  /**
   * Text/label color to place ON an accent-filled surface (a button). Picks whichever of white or
   * the brand dark brown reads better on the accent. For any accent this yields at least ~4:1,
   * which clears WCAG AA-large (3:1) -- the applicable threshold because CTA labels are bold
   * (>=14pt bold). A pure-black option would be needed to guarantee 4.5 for arbitrary mid-tone
   * accents, but that reads harsh on a colored button and is unnecessary for bold label text.
   */
  onAccent: string
  /** Accent used as text on the dark panels, or a legible fallback when it would fail AA. */
  onDark: string
  /** Accent used as text on the light page, or a legible fallback when it would fail AA. */
  onLight: string
}

/**
 * Derive readable per-surface tokens from a validated accent hex. `accent` must already be a
 * safeColor-validated hex (the layout passes safeColor(accentColor, '#d4af6a')).
 */
export function accentColorTokens(accent: string): AccentTokens {
  const onAccent = contrastRatio(LIGHT_LABEL, accent) >= contrastRatio(DARK_LABEL, accent)
    ? LIGHT_LABEL
    : DARK_LABEL
  const onDark = contrastRatio(accent, DARK_SURFACE) >= AA_NORMAL ? accent : FALLBACK_ON_DARK
  const onLight = contrastRatio(accent, LIGHT_SURFACE) >= AA_NORMAL ? accent : FALLBACK_ON_LIGHT
  return { onAccent, onDark, onLight }
}
