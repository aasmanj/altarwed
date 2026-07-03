import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #185: several dashboard form controls rendered a <label> as a plain
// sibling of the <input> with no htmlFor/id pairing and no wrapping, so the
// input had no programmatic accessible name (WCAG 1.3.1 / 4.1.2). frontend-app
// has no jsx-a11y lint gate, which is how this hid.
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the label association is verified with source-level assertions on the
// specific helpers and inputs, mirroring the approach the sibling hardening PRs
// used (heroFocalPointPreview.test.ts, venuePhotoUpload.test.ts). Each positive
// assertion below fails on the pre-fix source and passes after.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Extract a named function declaration's source (from `function Name(` up to the
// first closing brace at column 0) so assertions target that helper, not the
// whole file.
function funcSource(src: string, name: string): string {
  const re = new RegExp(`function ${name}\\(([\\s\\S]*?)\\n\\}`)
  const match = src.match(re)
  expect(match, `expected to find function ${name}`).not.toBeNull()
  return match![0]
}

// The WeddingWebsiteEditor Row/Input/Textarea label-association suite that
// used to live here was removed along with the classic editor (issue #181).

describe('WeddingWebsiteSetup Field helper label association (issue #185)', () => {
  const src = read('features/couple/website/WeddingWebsiteSetup.tsx')

  it('nests the control inside the <label> instead of an unassociated sibling', () => {
    const field = funcSource(src, 'Field')
    // The control is wrapped by the label...
    expect(field).toContain('<label className="block">')
    expect(field).toContain('{children}')
    // ...and the label text is a <span>, not a second sibling <label> that
    // pointed at nothing (the pre-fix defect).
    expect(field).toContain('<span className="block text-sm font-medium text-brown mb-1.5">{label}</span>')
    expect(field).not.toContain('<label className="block text-sm font-medium text-brown mb-1.5">{label}</label>')
  })
})

describe('SideBySideEditor hero settings label association (issue #185)', () => {
  const src = read('features/couple/website/blocks/SideBySideEditor.tsx')

  const pairs: [string, string][] = [
    ['hero-tagline', 'Tagline (shown over the photo)'],
    ['hero-bride-name', 'Bride'],
    ['hero-groom-name', 'Groom'],
  ]

  for (const [id, labelText] of pairs) {
    it(`wires the "${labelText}" input with htmlFor/id "${id}"`, () => {
      expect(src).toContain(`<label htmlFor="${id}"`)
      expect(src).toContain(`id="${id}"`)
    })
  }
})
