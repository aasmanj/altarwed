// Issue #357: curated theme palette presets for the wedding-site accent color.
//
// The only accent control used to be a bare <input type="color">, which across
// thousands of couples tends to produce clashing, low-contrast picks. These
// hand-picked faith-first swatches stay legible on the ivory site backgrounds
// while the custom picker remains available for fine-tuning.
//
// This logic lives in its own module (rather than inline in SideBySideEditor)
// so it is cheap to unit-test without rendering the whole editor component.

export interface AccentPreset {
  name: string
  hex: string
}

// Hex values are lowercase to match the native <input type="color"> value
// format, which lets isAccentPresetSelected compare without normalising.
export const ACCENT_PRESETS: ReadonlyArray<AccentPreset> = [
  { name: 'Gold', hex: '#d4af6a' },
  { name: 'Sage', hex: '#9caf88' },
  { name: 'Dusty blue', hex: '#7c92a8' },
  { name: 'Blush', hex: '#dda6a6' },
  { name: 'Burgundy', hex: '#7b2d3a' },
  { name: 'Slate', hex: '#4a5568' },
  { name: 'Terracotta', hex: '#c17a54' },
  { name: 'Plum', hex: '#6b4a5e' },
]

// Returns true when the current accent equals this preset, so its swatch shows
// the selected state. Case-insensitive so a hex saved in a different case (or
// typed via the custom picker) still highlights the matching swatch. A null or
// empty accent (never set) matches nothing.
export function isAccentPresetSelected(
  accentColor: string | null | undefined,
  presetHex: string,
): boolean {
  if (!accentColor) return false
  return accentColor.toLowerCase() === presetHex.toLowerCase()
}
