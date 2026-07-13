// Couple-selectable font-pairing themes for the public wedding site (issue #358).
//
// A theme is a curated heading + body font pairing. The couple picks a short KEY
// ("modern", "editorial", ...) in the dashboard. To avoid a new DB column/migration
// the key is stored inside the existing opaque `customTabLabels` JSON settings column
// under the reserved key "__theme" (see FONT_THEME_STORAGE_KEY). The backend never
// inspects that column, and parseTabCustomisation already ignores any non-tab key, so
// the reserved key rides along safely with the tab-label map.
//
// This helper is the render-path counterpart to safeFont/safeColor: the returned
// font-family stacks flow into a <style> sink, so we NEVER interpolate the raw stored
// value. An unknown, null, or hostile key falls back to the "classic" pair (the
// pre-#358 default: Playfair headings + Inter body), so an unset site renders exactly
// as before and no untrusted text can reach the style tag.
//
// Keep FONT_THEME_KEYS in sync with the dashboard picker in
// frontend-app/src/features/couple/website/blocks/fontThemes.ts and the next/font
// families declared in app/layout.tsx.

export interface FontThemePair {
  // CSS font-family stack for headings (h1-h6 inside the wedding layout).
  heading: string
  // CSS font-family stack for body copy.
  body: string
}

// The reserved key under which the font-theme choice lives in customTabLabels.
// Double-underscore prefix so it can never collide with a BlockTab enum name.
export const FONT_THEME_STORAGE_KEY = '__theme'

const FONT_THEME_PAIRS: Record<string, FontThemePair> = {
  // Default (also used for null/unknown/malformed). Matches the pre-#358 look:
  // Playfair headings, Inter body.
  classic: {
    heading: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  // Clean geometric sans headings over the same neutral body.
  modern: {
    heading: 'var(--font-montserrat), system-ui, sans-serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  // High-contrast editorial serif headings with a warm humanist sans body.
  editorial: {
    heading: 'var(--font-cormorant), Georgia, serif',
    body: 'var(--font-lato), system-ui, sans-serif',
  },
  // Handwritten script headings (used as an accent) over a legible sans body.
  romantic: {
    heading: 'var(--font-dancing-script), cursive',
    body: 'var(--font-lato), system-ui, sans-serif',
  },
}

const DEFAULT_FONT_THEME = 'classic'

// Ordered allowlist of theme keys, exported so tests and any future picker can render
// from a single source of truth.
export const FONT_THEME_KEYS = Object.keys(FONT_THEME_PAIRS)

/**
 * Extract the stored font-theme key from the opaque customTabLabels JSON, or null when
 * absent/invalid. Uses Object.hasOwn so prototype-chain keys never leak in, and JSON
 * parse failures fall through to null (the caller then uses the default pair).
 */
export function readFontThemeKey(customTabLabels: string | null | undefined): string | null {
  if (typeof customTabLabels !== 'string' || customTabLabels === '') return null
  try {
    const parsed = JSON.parse(customTabLabels) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    if (!Object.hasOwn(record, FONT_THEME_STORAGE_KEY)) return null
    const key = record[FONT_THEME_STORAGE_KEY]
    return typeof key === 'string' && Object.hasOwn(FONT_THEME_PAIRS, key) ? key : null
  } catch {
    return null
  }
}

/**
 * Return the heading + body font-family stacks for the theme stored in customTabLabels,
 * defaulting to the "classic" pair for null/unknown/invalid input. Pure (no Node/React
 * dependency), safe to import from server and client components.
 */
export function safeFontTheme(customTabLabels: string | null | undefined): FontThemePair {
  const key = readFontThemeKey(customTabLabels)
  return key ? FONT_THEME_PAIRS[key] : FONT_THEME_PAIRS[DEFAULT_FONT_THEME]
}
