import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Issue #182: repositioning the hero image focal point in the side-by-side
// editor saved to the DB but did not refresh the live preview iframe, so the
// new crop only appeared after a manual refresh or tab switch. HeroLive patches
// the tagline and names client-side via postMessage but never the hero image
// crop, so the iframe reload triggered by bumpPreview is what actually shows a
// new focal point. The fix passes { onSuccess: bumpPreview } to the mutate call,
// matching the sibling onDefaultPhotoSelect / onScriptureBgColorSave handlers.
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the mutation wiring is verified via a source-level assertion on the
// onFocalPointSave handler body, mirroring the approach in draftBanner.test.ts.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Pull out the arrow-function body of a named handler prop so the assertions
// target that handler specifically rather than the whole file.
function handlerBody(src: string, handler: string): string {
  const re = new RegExp(`${handler}=\\{\\([^)]*\\) => \\{([\\s\\S]*?)\\n\\s*\\}\\}`)
  const match = src.match(re)
  expect(match, `expected to find handler ${handler}`).not.toBeNull()
  return match![1]
}

describe('SideBySideEditor hero focal point live preview (issue #182)', () => {
  const src = read('features/couple/website/blocks/SideBySideEditor.tsx')

  it('bumps the preview after saving a new hero focal point', () => {
    const body = handlerBody(src, 'onFocalPointSave')
    // Saves the focal point to the DB...
    expect(body).toContain('heroFocalPointX')
    expect(body).toContain('heroFocalPointY')
    // ...and refreshes the live preview iframe so the new crop shows without a
    // manual refresh. This assertion fails on the pre-fix source.
    expect(body).toContain('onSuccess: bumpPreview')
  })

  it('matches the sibling hero mutations that already bump the preview', () => {
    // Guards against a regression where only one handler is wired correctly.
    expect(handlerBody(src, 'onDefaultPhotoSelect')).toContain('onSuccess: bumpPreview')
    expect(handlerBody(src, 'onScriptureBgColorSave')).toContain('onSuccess: bumpPreview')
  })
})
