import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { TOUCH_REVEAL } from '@/lib/touchReveal'

// Touch-reveal guard for issue #299. vitest runs here in a plain node environment
// (no jsdom / testing-library), so like goldCtaContrast.test.ts we assert on the
// load-bearing className strings instead of rendering. Each assertion fails on the
// pre-fix source (hover-only overlay that is pointer-events-none over the enlarge
// button, hover-only unassign X) and passes after, which is the behavioral contract
// for these class-only changes.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

const PHOTOS = 'features/couple/photos/PhotosPage.tsx'
const SEATING = 'features/couple/seating/SeatingPage.tsx'

describe('touch reveal of hover-only controls #299', () => {
  it('the shared constant reveals on hover, keyboard focus, and hover-incapable devices', () => {
    // Hidden at rest on hover-capable devices, revealed by hover or focus.
    expect(TOUCH_REVEAL).toContain('opacity-0')
    expect(TOUCH_REVEAL).toContain('group-hover:opacity-100')
    expect(TOUCH_REVEAL).toContain('focus-within:opacity-100')
    // The load-bearing class: on devices that cannot hover, always visible.
    expect(TOUCH_REVEAL).toContain('[@media(hover:none)]:opacity-100')
    // The constant must stay pointer-events-agnostic; overlays manage that per-use
    // (see the convention comment in src/lib/touchReveal.ts).
    expect(TOUCH_REVEAL).not.toContain('pointer-events')
  })

  it('PhotosPage overlay adopts TOUCH_REVEAL instead of a hover-only reveal', () => {
    const src = read(PHOTOS)
    expect(src).toContain("import { TOUCH_REVEAL } from '@/lib/touchReveal'")
    // The overlay container interpolates the shared constant.
    expect(src).toMatch(/pointer-events-none \$\{TOUCH_REVEAL\}/)
    // The pre-fix hover-only combo is gone from the file.
    expect(src).not.toContain('opacity-0 group-hover:opacity-100')
  })

  it('PhotosPage resolves the enlarge-vs-controls tap conflict via pointer events', () => {
    const src = read(PHOTOS)
    // The container must never flip to pointer-events-auto (that is what swallowed
    // taps meant for the enlarge button underneath).
    expect(src).not.toContain('group-hover:pointer-events-auto')
    expect(src).not.toContain('[@media(hover:none)]:pointer-events-auto')
    // Each of the three overlay controls (reposition, edit caption, delete) opts
    // back into pointer events individually, so taps between them fall through to
    // the enlarge button and the lightbox still opens from the photo area. Count
    // className usages only (the convention comment mentions the class too).
    const optIns = src.match(/className="pointer-events-auto /g) ?? []
    expect(optIns.length).toBe(3)
  })

  it('SeatingPage unassign X adopts TOUCH_REVEAL so touch users can remove a seated guest', () => {
    const src = read(SEATING)
    expect(src).toContain("import { TOUCH_REVEAL } from '@/lib/touchReveal'")
    expect(src).toMatch(/\$\{TOUCH_REVEAL\} transition/)
    expect(src).not.toContain('opacity-0 group-hover:opacity-100')
  })

  it('no hover-only reveal (without the hover:none escape) remains in the touched files', () => {
    // Regression guard: any className in these files pairing opacity-0 with
    // group-hover:opacity-100 as a raw string has bypassed the shared constant.
    const offenders: string[] = []
    for (const rel of [PHOTOS, SEATING]) {
      const src = read(rel)
      const raw = src.match(/["'`][^"'`]*opacity-0[^"'`]*group-hover:opacity-100[^"'`]*["'`]/g) ?? []
      for (const hit of raw) {
        if (!hit.includes('[@media(hover:none)]:opacity-100')) {
          offenders.push(`${rel}: ${hit.replace(/\s+/g, ' ').trim()}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
