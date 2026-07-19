// Couple-selectable hero presentation controls for the public wedding page (issue #360).
//
// Two independent knobs, both stored on the wedding website record and both rendered into
// a style sink on the hero, so like safeColor/safeFont this file NEVER interpolates a raw
// stored value: it clamps/allowlists first, then derives the CSS from the safe result.
//
//   heroOverlayDarkness -> safeHeroOverlayGradient(): a numeric 0-100 scrim intensity. The
//     backend @Min/@Max already clamps it, but the render path clamps again (defence in
//     depth against a future direct DB write) and computes three alpha stops from the
//     bounded number. No untrusted string can reach the returned gradient.
//
//   heroLayout -> safeHeroLayout(): an allowlisted key, "full" (default full-bleed cover
//     crop) or "framed" (contain the whole photo so a portrait hero is not cropped hard).
//     Unknown/null/hostile input falls back to "full".

export type HeroLayout = 'full' | 'framed'

const HERO_LAYOUTS: readonly HeroLayout[] = ['full', 'framed']

// Pre-#360 default scrim. The original hero used a fixed Tailwind gradient
// `from-black/70 via-black/20 to-black/10`; darkness 70 reproduces it exactly, so an
// unset site (null) renders pixel-identically.
export const DEFAULT_HERO_OVERLAY_DARKNESS = 70

// Ratio of the mid/top alpha to the bottom alpha, taken from the original 0.70/0.20/0.10
// gradient (0.20/0.70 and 0.10/0.70). Scaling all three from a single darkness value keeps
// the gradient's shape while letting the couple dial the whole scrim up or down.
const MID_RATIO = 0.2 / 0.7
const TOP_RATIO = 0.1 / 0.7

/**
 * Clamp a stored darkness value to the 0-100 range, defaulting to
 * {@link DEFAULT_HERO_OVERLAY_DARKNESS} for null/undefined/NaN. Exported for tests and any
 * UI that needs the effective numeric value (e.g. an aria description).
 */
export function safeHeroOverlayDarkness(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_HERO_OVERLAY_DARKNESS
  return Math.min(100, Math.max(0, Math.round(value)))
}

/**
 * Build the hero scrim as a CSS `linear-gradient(to top, ...)` string from a stored darkness
 * value. Darkest at the bottom (where the white couple names sit), fading toward the top, so
 * a bright photo no longer washes the names out. Pure; safe to import from server components.
 */
export function safeHeroOverlayGradient(value: number | null | undefined): string {
  const bottom = safeHeroOverlayDarkness(value) / 100
  const mid = bottom * MID_RATIO
  const top = bottom * TOP_RATIO
  const a = (n: number) => `rgba(0,0,0,${n.toFixed(3)})`
  return `linear-gradient(to top, ${a(bottom)} 0%, ${a(mid)} 50%, ${a(top)} 100%)`
}

/**
 * Return the allowlisted hero layout key for a stored value, defaulting to "full" for
 * null/unknown/invalid input. Never returns a raw stored string.
 */
export function safeHeroLayout(value: string | null | undefined): HeroLayout {
  return typeof value === 'string' && (HERO_LAYOUTS as readonly string[]).includes(value)
    ? (value as HeroLayout)
    : 'full'
}
