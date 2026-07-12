// Couple-selectable display fonts for the wedding-hero names (the `nameFont` feature).
//
// A couple picks a short KEY ("cormorant", "greatvibes", ...) in the dashboard; the
// backend stores that key and its @Pattern rejects anything off this list. This helper
// maps a stored key to a full CSS font-family stack built on the next/font variables
// declared in app/layout.tsx. It is the render-path counterpart to safeColor: the value
// flows into a `<style>` sink, so we NEVER interpolate the raw stored string. An unknown,
// null, or hostile key falls back to the default serif (Playfair), so the hero always
// renders a sensible font and no untrusted text can reach the style tag.
//
// Keep NAME_FONT_KEYS in sync with the backend @Pattern on
// UpdateWeddingWebsiteRequest.nameFont and the dashboard picker.
const NAME_FONT_STACKS: Record<string, string> = {
  playfair: 'var(--font-playfair), Georgia, serif',
  cormorant: 'var(--font-cormorant), Georgia, serif',
  greatvibes: 'var(--font-great-vibes), cursive',
  montserrat: 'var(--font-montserrat), system-ui, sans-serif',
  lora: 'var(--font-lora), Georgia, serif',
}

// Hero-name font-weight per key. Most families ship a bold weight; Great Vibes is a
// single-weight (400) script face, so asking the browser for bold synthesizes a smeared
// faux-bold on the hero (the highest-visibility surface). Render it at its real 400.
const NAME_FONT_WEIGHTS: Record<string, string> = {
  playfair: '700',
  cormorant: '700',
  greatvibes: '400',
  montserrat: '700',
  lora: '700',
}

// The default when the couple has not chosen a font (null) or the stored key is unknown.
const DEFAULT_NAME_FONT = NAME_FONT_STACKS.playfair
const DEFAULT_NAME_FONT_WEIGHT = NAME_FONT_WEIGHTS.playfair

/**
 * Return the CSS font-family stack for a stored `nameFont` key, or the default serif
 * stack for null/unknown/invalid input. Pure (no Node/React dependency), safe to import
 * from server and client components.
 *
 * Uses Object.hasOwn so prototype-chain keys ("__proto__", "constructor", "toString", ...)
 * fall back to the default instead of leaking an inherited member into the <style> sink.
 */
export function safeNameFont(key: string | null | undefined): string {
  return typeof key === 'string' && Object.hasOwn(NAME_FONT_STACKS, key)
    ? NAME_FONT_STACKS[key]
    : DEFAULT_NAME_FONT
}

/**
 * Return the font-weight to pair with safeNameFont for the same key. Same allowlist
 * posture: unknown/null/prototype keys get the default weight.
 */
export function safeNameFontWeight(key: string | null | undefined): string {
  return typeof key === 'string' && Object.hasOwn(NAME_FONT_WEIGHTS, key)
    ? NAME_FONT_WEIGHTS[key]
    : DEFAULT_NAME_FONT_WEIGHT
}

// Ordered allowlist of selectable font keys, for the dashboard picker to render options
// from a single source of truth.
export const NAME_FONT_KEYS = Object.keys(NAME_FONT_STACKS)
