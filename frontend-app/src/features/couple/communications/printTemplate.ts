// Print-card template helpers (issue #362). Kept as a pure module (no React) so the composition
// and parsing rules can be unit-tested directly and so the CommunicationsPage preview + submit
// path share one source of truth with the backend PrintTemplate allowlist.
//
// Contract mirror: the backend enum PrintTemplate is the authority. A base templateKey is
// {SAVE_THE_DATE|INVITATION}_{CLASSIC|PHOTO|MINIMAL|BOTANICAL|DARK_ELEGANT}. A PHOTO base may
// additionally carry a strictly-validated overlay suffix "~{position}~{theme}" so the couple's
// 3x3 position + light/dark choice rides on the existing template_key column (no schema change).

export type PrintOrderTypeKey = 'SAVE_THE_DATE' | 'INVITATION'

// The base design keys, without any PHOTO overlay suffix.
export type BaseTemplateKey =
  | 'SAVE_THE_DATE_CLASSIC'
  | 'SAVE_THE_DATE_PHOTO'
  | 'SAVE_THE_DATE_MINIMAL'
  | 'SAVE_THE_DATE_BOTANICAL'
  | 'SAVE_THE_DATE_DARK_ELEGANT'
  | 'INVITATION_CLASSIC'
  | 'INVITATION_PHOTO'
  | 'INVITATION_MINIMAL'
  | 'INVITATION_BOTANICAL'
  | 'INVITATION_DARK_ELEGANT'

export type TemplateStyle = 'CLASSIC' | 'PHOTO' | 'MINIMAL' | 'BOTANICAL' | 'DARK_ELEGANT'

// The 3x3 photo-overlay grid, matching the backend PrintTextPosition enum exactly.
export type TextPosition =
  | 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT'
  | 'MIDDLE_LEFT' | 'MIDDLE_CENTER' | 'MIDDLE_RIGHT'
  | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT'

export type OverlayTextTheme = 'LIGHT' | 'DARK'

// The proven defaults that match the original photo card (backend PrintTextPosition.DEFAULT /
// PrintOverlayTextTheme.DEFAULT), so a bare PHOTO key renders identically.
export const DEFAULT_TEXT_POSITION: TextPosition = 'BOTTOM_CENTER'
export const DEFAULT_OVERLAY_THEME: OverlayTextTheme = 'LIGHT'

// Row-major 3x3 grid used to render the position picker.
export const TEXT_POSITIONS: TextPosition[] = [
  'TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT',
  'MIDDLE_LEFT', 'MIDDLE_CENTER', 'MIDDLE_RIGHT',
  'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT',
]

const OVERLAY_DELIMITER = '~'

export function isPhotoTemplate(base: BaseTemplateKey): boolean {
  return base.endsWith('_PHOTO')
}

export function styleOf(base: BaseTemplateKey): TemplateStyle {
  if (base.startsWith('SAVE_THE_DATE_')) return base.slice('SAVE_THE_DATE_'.length) as TemplateStyle
  return base.slice('INVITATION_'.length) as TemplateStyle
}

/**
 * Compose the full templateKey sent to the backend. For a PHOTO base, append the couple's chosen
 * position + theme as a "~position~theme" suffix; for any other base, the overlay is meaningless
 * so the base key is returned unchanged (the backend rejects an overlay on a non-photo base).
 */
export function composePrintTemplateKey(
  base: BaseTemplateKey,
  position: TextPosition,
  theme: OverlayTextTheme,
): string {
  if (!isPhotoTemplate(base)) return base
  return `${base}${OVERLAY_DELIMITER}${position}${OVERLAY_DELIMITER}${theme}`
}

/**
 * Strip any overlay suffix back to the base key, used to label past orders (whose stored
 * templateKey may include the suffix) without a lookup miss.
 */
export function basePrintTemplateKey(fullKey: string): string {
  const i = fullKey.indexOf(OVERLAY_DELIMITER)
  return i < 0 ? fullKey : fullKey.slice(0, i)
}

// Grid geometry for the live preview, mirroring the backend photoOverlay() CSS mapping. `place`
// is the flex alignment for the overlay content box; `textAlign` matches the printed card.
export function overlayPlacement(position: TextPosition): {
  alignItems: 'flex-start' | 'center' | 'flex-end'
  justifyContent: 'flex-start' | 'center' | 'flex-end'
  textAlign: 'left' | 'center' | 'right'
} {
  const top = position.startsWith('TOP_')
  const bottom = position.startsWith('BOTTOM_')
  const left = position.endsWith('_LEFT')
  const right = position.endsWith('_RIGHT')
  return {
    justifyContent: top ? 'flex-start' : bottom ? 'flex-end' : 'center',
    alignItems: left ? 'flex-start' : right ? 'flex-end' : 'center',
    textAlign: left ? 'left' : right ? 'right' : 'center',
  }
}
