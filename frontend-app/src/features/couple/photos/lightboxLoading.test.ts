import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { lightboxSpinnerVisibleAfter } from './PhotosPage'

// Behavioral guard for issue #309(A): opening a photo in the lightbox swapped
// the image `src` with no loading state, so on a slow connection the enlarged
// area went blank until the full-size image arrived. The fix shows a spinner
// overlay from the moment a photo is opened until the image's own onLoad fires
// (onError also clears it so the spinner can never get stuck). vitest runs in a
// node environment here (no jsdom / testing-library), so we assert on the pure
// state-switch function plus the load-bearing JSX wiring. Each assertion fails
// on the pre-fix source and passes after, which is the contract for this fix.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('lightbox loading spinner state switch (#309A)', () => {
  it('shows the spinner the instant a photo is opened', () => {
    expect(lightboxSpinnerVisibleAfter('open')).toBe(true)
  })

  it('hides the spinner once the incoming image finishes loading', () => {
    expect(lightboxSpinnerVisibleAfter('loaded')).toBe(false)
  })

  it('hides the spinner on load error so it never gets stuck', () => {
    expect(lightboxSpinnerVisibleAfter('error')).toBe(false)
  })

  it('wires the onLoad-driven switch and spinner overlay into PhotosPage', () => {
    const src = read('features/couple/photos/PhotosPage.tsx')
    // Opening a photo primes the spinner.
    expect(src).toContain("setLightboxLoading(lightboxSpinnerVisibleAfter('open'))")
    // The enlarged image clears the spinner via its own onLoad / onError.
    expect(src).toContain("onLoad={() => setLightboxLoading(lightboxSpinnerVisibleAfter('loaded'))}")
    expect(src).toContain("onError={() => setLightboxLoading(lightboxSpinnerVisibleAfter('error'))}")
    // Cache-hit path: onLoad does not fire for an already-complete (cached)
    // image, so a ref + effect reads img.complete to clear the stuck spinner.
    expect(src).toContain('lightboxImgRef.current?.complete')
    // The overlay only renders while loading, and does not eat pointer events
    // (so the backdrop click-to-close still works underneath it).
    expect(src).toContain('{lightboxLoading && (')
    expect(src).toContain('pointer-events-none')
  })
})
