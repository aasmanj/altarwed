// Font-pairing themes for the wedding website editor (issue #358).
//
// A theme is a curated heading + body font pairing the couple picks in the design
// settings drawer. To avoid a new DB column/migration the chosen key is stored inside
// the existing opaque `customTabLabels` JSON settings column under the reserved key
// "__theme". The backend never inspects that column; the public renderer's
// parseTabCustomisation already ignores any non-tab key, and the public safeFontTheme()
// reads the same reserved key back out. Keep these keys in sync with
// frontend-public/src/lib/safeFontTheme.ts.

// Reserved key under which the theme choice lives in customTabLabels. Double-underscore
// prefix so it can never collide with a BlockTab enum name (the map's real keys).
export const FONT_THEME_STORAGE_KEY = '__theme'

// The default theme. Stored as "nothing" (the key is omitted) so an unset site keeps a
// clean/empty customTabLabels value and renders exactly as it did before #358.
export const DEFAULT_FONT_THEME = 'classic'

// Picker options. `key` is the stored value (mirrored by the public allowlist); `label`
// and `description` are only what the couple sees.
export const FONT_THEME_OPTIONS: { key: string; label: string; description: string }[] = [
  { key: 'classic', label: 'Classic', description: 'Playfair headings + Inter body (default)' },
  { key: 'modern', label: 'Modern', description: 'Montserrat headings + Inter body' },
  { key: 'editorial', label: 'Editorial', description: 'Cormorant headings + Lato body' },
  { key: 'romantic', label: 'Romantic', description: 'Dancing Script headings + Lato body' },
]

const FONT_THEME_KEYS = new Set(FONT_THEME_OPTIONS.map(o => o.key))

// Parse the opaque customTabLabels JSON into a plain tab-label map, stripping the
// reserved theme key so the tab-label editor only ever manages real tab labels.
export function parseTabLabels(customTabLabels: string | null | undefined): Record<string, string> {
  if (!customTabLabels) return {}
  try {
    const parsed = JSON.parse(customTabLabels)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (k !== FONT_THEME_STORAGE_KEY && typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

// Read the stored theme key, defaulting to "classic" for absent/unknown/invalid input.
export function readFontThemeKey(customTabLabels: string | null | undefined): string {
  if (!customTabLabels) return DEFAULT_FONT_THEME
  try {
    const parsed = JSON.parse(customTabLabels)
    const key = parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)[FONT_THEME_STORAGE_KEY]
      : null
    return typeof key === 'string' && FONT_THEME_KEYS.has(key) ? key : DEFAULT_FONT_THEME
  } catch {
    return DEFAULT_FONT_THEME
  }
}

// Serialize a tab-label map plus the chosen theme back into the single opaque
// customTabLabels string. The default theme writes no reserved key so an otherwise
// empty map serializes to '' (matching the pre-#358 "no customisation" value). This is
// the single writer of customTabLabels, so tab labels and theme never clobber each other.
export function serializeTabLabels(labels: Record<string, string>, themeKey: string): string {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(labels)) {
    if (k !== FONT_THEME_STORAGE_KEY && typeof v === 'string' && v.trim()) out[k] = v
  }
  if (themeKey && themeKey !== DEFAULT_FONT_THEME && FONT_THEME_KEYS.has(themeKey)) {
    out[FONT_THEME_STORAGE_KEY] = themeKey
  }
  return Object.keys(out).length === 0 ? '' : JSON.stringify(out)
}

// Issue #359: the font theme (Design panel) and the tab labels (Tabs panel) are now edited
// in two separate panels but still share the single opaque customTabLabels column. These
// two merge helpers are how each panel writes only its own slice without clobbering the
// other: each reads the current column, keeps the half it does not own, and rewrites both.

// Change only the theme, preserving whatever tab labels are already stored.
export function withFontTheme(customTabLabels: string | null | undefined, themeKey: string): string {
  return serializeTabLabels(parseTabLabels(customTabLabels), themeKey)
}

// Change only the tab labels, preserving whatever theme is already stored.
export function withTabLabels(
  customTabLabels: string | null | undefined,
  labels: Record<string, string>,
): string {
  return serializeTabLabels(labels, readFontThemeKey(customTabLabels))
}
