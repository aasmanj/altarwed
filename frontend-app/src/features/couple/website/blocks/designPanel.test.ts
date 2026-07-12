import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #359: split a dedicated Design panel that groups every theme control (accent/palette,
// font theme, hero overlay color, scripture banner color) into one clearly labeled place, and
// leave the Tabs panel as hide/rename only.
//
// This workspace's vitest runs in a node environment (no jsdom / @testing-library/react
// installed, and the issue forbids adding new dependencies), so full DOM rendering is not
// available here; that constraint is documented in AnimatedModal.test.ts and others. The
// grouping contract is therefore verified by asserting against the editor's source: that the
// DesignPanel component actually renders each control, that a clearly labeled Design entry
// point mounts it, and that the controls no longer live in the Tabs panel. The persistence
// round-trip is proven separately in fontThemes.test.ts (withFontTheme / withTabLabels).

const SRC = readFileSync(
  path.join(process.cwd(), 'src/features/couple/website/blocks/SideBySideEditor.tsx'),
  'utf8',
)

// Extract a top-level function body by name: from `function Name(` up to the next top-level
// `function ` declaration. Good enough for asserting which controls live in which component.
function fnBody(name: string): string {
  const start = SRC.indexOf(`function ${name}(`)
  expect(start, `function ${name} should exist`).toBeGreaterThanOrEqual(0)
  const rest = SRC.slice(start)
  const nextIdx = rest.indexOf('\nfunction ', 1)
  return nextIdx === -1 ? rest : rest.slice(0, nextIdx)
}

describe('Design panel grouping (issue #359)', () => {
  it('exposes a clearly labeled Design entry point that mounts the DesignPanel', () => {
    // A dedicated button (not buried inside the tabs drawer) toggles the design drawer.
    expect(SRC).toContain('<Palette ')
    expect(SRC).toContain('Colors, palette, and fonts')
    expect(SRC).toMatch(/<span className="hidden sm:inline">Design<\/span>/)
    // The button mounts the DesignPanel component.
    expect(SRC).toContain('<DesignPanel')
  })

  it('the DesignPanel groups accent/palette, font theme, hero overlay and scripture colors', () => {
    const design = fnBody('DesignPanel')
    // Accent color + curated palette presets.
    expect(design).toContain('ACCENT_PRESETS')
    expect(design).toContain('Accent color and palette')
    // Font-pairing theme (from issue #358) now lives here.
    expect(design).toContain('FONT_THEME_OPTIONS')
    expect(design).toContain('Font theme')
    // Hero overlay (tagline text color over the hero photo).
    expect(design).toContain('Hero overlay color')
    expect(design).toContain('design-tagline-color')
    // Scripture banner color.
    expect(design).toContain('Scripture banner color')
    expect(design).toContain('design-scripture-bg-color')
  })

  it('the DesignPanel reuses the existing save paths (no new persistence)', () => {
    const design = fnBody('DesignPanel')
    // Colors persist through the same website-record callbacks as before the split.
    expect(design).toContain('onAccentColorSave')
    expect(design).toContain('onTaglineColorSave')
    expect(design).toContain('onScriptureBgColorSave')
    // Live hero preview keeps working via the same postMessage channel.
    expect(design).toContain('onTaglineColorLive')
    // The font theme still writes the shared customTabLabels column, merged so it cannot
    // clobber the tab labels the Tabs panel owns.
    expect(SRC).toContain('withFontTheme(website.customTabLabels')
  })

  it('the Tabs panel is now hide/rename only (theme controls moved out)', () => {
    const tabs = fnBody('TabSettingsPanel')
    // Accent presets and the font theme no longer live in the Tabs panel.
    expect(tabs).not.toContain('ACCENT_PRESETS')
    expect(tabs).not.toContain('FONT_THEME_OPTIONS')
    expect(tabs).not.toContain('onAccentColorSave')
    // Hide + rename still live here, and label saves still preserve the theme.
    expect(tabs).toContain('toggleHidden')
    expect(tabs).toContain('withTabLabels(website.customTabLabels')
  })

  it('the hero editor no longer owns the moved color controls', () => {
    const hero = fnBody('HeroSettings')
    // The tagline color and scripture banner color inputs moved to the Design panel.
    expect(hero).not.toContain('hero-tagline-color')
    expect(hero).not.toContain('scripture-bg-color')
    expect(hero).not.toContain('Banner background color')
  })

  it('contains no em dashes anywhere in the editor source', () => {
    expect(SRC).not.toContain(String.fromCharCode(0x2014))
  })
})
