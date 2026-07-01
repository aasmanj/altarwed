import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level accessibility guards for issue #112 (frontend-app half). vitest
// runs in a node environment here (no jsdom / testing-library), so rather than
// render the components we assert on the load-bearing JSX. Each assertion fails
// on the pre-fix source and passes after, which is the behavioral contract for
// these markup-only a11y changes:
//   1. Onboarding default-hero buttons carry an aria-label (not 6 empty buttons)
//   2. The photo caption textarea has a programmatic label, not just a placeholder
//   3. The focal-point picker is operable from the keyboard via arrow keys
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('a11y cluster #112 (frontend-app)', () => {
  it('onboarding default-hero buttons expose an aria-label so screen readers announce distinct controls', () => {
    const src = read('features/couple/onboarding/OnboardingWizard.tsx')
    // The default-photo grid button must carry a per-photo aria-label.
    expect(src).toContain('aria-label={`Use default hero photo: ${name}`}')
    // Selection state is announced, not signalled by the check overlay alone.
    expect(src).toContain('aria-pressed={selected}')
  })

  it('photo caption textarea has a programmatic label, not only a placeholder', () => {
    const src = read('features/couple/photos/PhotosPage.tsx')
    expect(src).toContain('aria-label="Photo caption"')
  })

  it('focal-point picker supports arrow-key nudging, not just Enter/Space recenter', () => {
    const src = read('features/couple/website/blocks/SideBySideEditor.tsx')
    // All four arrow keys must be handled so a keyboard user can set a point.
    expect(src).toContain("case 'ArrowLeft'")
    expect(src).toContain("case 'ArrowRight'")
    expect(src).toContain("case 'ArrowUp'")
    expect(src).toContain("case 'ArrowDown'")
    // The old handler only reset to center on Enter/Space and ignored arrows;
    // arrow presses must now move the point and prevent page scroll.
    expect(src).toContain('e.preventDefault()')
    // The label tells the keyboard user the arrow keys are available.
    expect(src).toContain('use the arrow keys')
  })
})
