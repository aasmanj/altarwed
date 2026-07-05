// Couple-controlled color fields (accentColor, heroTaglineColor,
// scriptureBackgroundColor) are stored in the database and flow into SSR output:
// some into a `<style>` tag, others into React inline style objects. The backend
// enforces a @Pattern on write, but this guards the render path against any
// future direct DB writes, migrations, or bugs that could smuggle a non-color
// string into a style sink. Every public/preview call site funnels through this
// one helper so the validation can never drift between them.
//
// The pattern matches a leading `#` followed by 3 to 8 hex digits, covering
// #rgb, #rgba, #rrggbb, and #rrggbbaa. It intentionally mirrors the original
// accentColor check so existing valid values keep rendering unchanged.
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

/**
 * Return `value` when it is a valid hex color, otherwise the `fallback`.
 *
 * Pure (no Node or React dependency), so it is safe to import from both server
 * components and client components. Pass a color string as the fallback for
 * required colors (accent, tagline), or `undefined` for optional colors whose
 * absence should trigger a CSS-class default (scripture banner gradient).
 */
export function safeColor<T extends string | undefined>(
  value: string | null | undefined,
  fallback: T,
): string | T {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback
}
