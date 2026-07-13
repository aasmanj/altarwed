// Issue #355: styling for the printable ceremony program.
//
// Two couple-controlled dials live here, kept as pure logic so they are cheap to
// unit-test without rendering the whole page component:
//
//   1. Accent color  -- reuses the couple's already-persisted website.accentColor
//      (the same field the public site uses). safeAccent mirrors the public
//      safeColor helper so a non-color string can never reach a style sink.
//   2. Program style  -- a small typography preset (Classic serif / Modern sans /
//      Script accent) chosen per couple. There is no backend column for this and
//      we do not add a Flyway migration for a print-only preference, so the choice
//      persists in localStorage keyed by coupleId. The functions take a Storage so
//      they are testable under vitest's node environment (where window is absent).

// Matches a leading `#` followed by 3 to 8 hex digits (#rgb, #rgba, #rrggbb,
// #rrggbbaa). Intentionally mirrors frontend-public/src/lib/safeColor.ts so the
// dashboard render path validates accent colors exactly like the public site.
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

/**
 * Return `value` when it is a valid hex color, otherwise `fallback`. Pass a color
 * string for a required color, or `null` to keep an existing CSS-class default when
 * the couple has not set an accent.
 */
export function safeAccent<T extends string | null>(
  value: string | null | undefined,
  fallback: T,
): string | T {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback
}

export type CeremonyStyleKey = 'classic' | 'modern' | 'script'

export interface CeremonyStyle {
  key: CeremonyStyleKey
  label: string
  // Tailwind font-family class for the couple's names, section headings, and the
  // closing line -- the showy display type that gives each style its character.
  displayFont: string
  // Tailwind font-family class for the running body text (order titles, roles,
  // party names). Kept legible even under the script style.
  bodyFont: string
  // Tailwind font-family class for the drop-cap order-of-service numerals.
  numeralFont: string
}

// Classic is first (the default) and reproduces the pre-#355 look, so an existing
// couple's program is unchanged until they deliberately pick another style.
export const CEREMONY_STYLES: Record<CeremonyStyleKey, CeremonyStyle> = {
  classic: {
    key: 'classic',
    label: 'Classic serif',
    displayFont: 'font-serif',
    bodyFont: 'font-serif',
    numeralFont: 'font-serif',
  },
  modern: {
    key: 'modern',
    label: 'Modern sans',
    displayFont: 'font-sans',
    bodyFont: 'font-sans',
    numeralFont: 'font-sans',
  },
  script: {
    key: 'script',
    label: 'Script accent',
    displayFont: 'font-script',
    bodyFont: 'font-serif',
    numeralFont: 'font-script',
  },
}

export const CEREMONY_STYLE_OPTIONS: ReadonlyArray<CeremonyStyle> =
  Object.values(CEREMONY_STYLES)

export const DEFAULT_CEREMONY_STYLE_KEY: CeremonyStyleKey = 'classic'

/**
 * Coerce an untrusted value (localStorage read, stale state) to a known style key,
 * falling back to Classic for anything off the allowlist. Uses an own-property check
 * so prototype-chain keys ("__proto__", "toString", ...) never resolve to a style.
 */
export function resolveCeremonyStyleKey(
  value: string | null | undefined,
): CeremonyStyleKey {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(CEREMONY_STYLES, value)
    ? (value as CeremonyStyleKey)
    : DEFAULT_CEREMONY_STYLE_KEY
}

/** Resolve a stored key to its full style preset (defaults to Classic). */
export function resolveCeremonyStyle(value: string | null | undefined): CeremonyStyle {
  return CEREMONY_STYLES[resolveCeremonyStyleKey(value)]
}

// localStorage key is namespaced and scoped per couple so two couples sharing a
// browser (or a couple with two websites) never see each other's preference.
export function ceremonyStyleStorageKey(coupleId: string): string {
  return `altarwed.ceremonyStyle.${coupleId}`
}

/**
 * Read the saved style key for a couple, falling back to Classic when storage is
 * unavailable (SSR/tests), empty, or holds an unknown value. `storage` is passed in
 * (rather than reaching for window) so this stays pure and testable.
 */
export function loadCeremonyStyleKey(
  storage: Storage | undefined,
  coupleId: string,
): CeremonyStyleKey {
  if (!storage) return DEFAULT_CEREMONY_STYLE_KEY
  try {
    return resolveCeremonyStyleKey(storage.getItem(ceremonyStyleStorageKey(coupleId)))
  } catch {
    // Private-mode or disabled storage throws on access; degrade to the default.
    return DEFAULT_CEREMONY_STYLE_KEY
  }
}

/** Persist a couple's style choice. No-ops safely when storage is unavailable. */
export function saveCeremonyStyleKey(
  storage: Storage | undefined,
  coupleId: string,
  key: CeremonyStyleKey,
): void {
  if (!storage) return
  try {
    storage.setItem(ceremonyStyleStorageKey(coupleId), key)
  } catch {
    // Ignore quota/private-mode failures: a lost print preference is not worth a crash.
  }
}
