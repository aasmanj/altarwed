import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { contentScrollTop, isPlainLeftClick, scrollBehaviorFor } from './weddingNavScroll'
import type { ClickModifiers } from './weddingNavScroll'

// Issue #298: tab clicks on the public wedding site must keep the guest at the
// content area, just below the sticky nav, instead of Next's default scroll
// which either resets to the very top (above the 85vh hero) or scrollIntoView()s
// the new segment underneath the sticky z-40 nav.
//
// vitest runs here in a plain node environment (no jsdom / testing-library),
// so the pure positioning logic lives in weddingNavScroll.ts and is tested
// directly, while the wiring inside the client components is guarded at the
// source level (same pattern as rsvpHeroCta.test.ts).

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('contentScrollTop (issue #298)', () => {
  // Representative geometry: 85vh hero (~638px at a 750px viewport) plus a
  // ~400px scripture banner puts <main> at 1038px absolute; nav is ~51px tall.

  it('guest scrolled deep into a long tab: target is main top minus nav height, not 0', () => {
    // Guest at scrollY 2400 reading photos; main's viewport-relative top is
    // 1038 - 2400 = -1362. Target must be main's absolute top (1038) minus the
    // nav height (51) = 987, i.e. nav pinned with content right below it.
    expect(contentScrollTop(-1362, 2400, 51)).toBe(987)
  })

  it('guest still above the hero: scrolls DOWN to the content, same target', () => {
    // At scrollY 0 main's viewport-relative top equals its absolute position.
    expect(contentScrollTop(1038, 0, 51)).toBe(987)
  })

  it('target is direction-independent: forward and back tab hops land identically', () => {
    const fromPhotosDeep = contentScrollTop(-1362, 2400, 51)
    const fromTopOfPage = contentScrollTop(1038, 0, 51)
    const fromMidHero = contentScrollTop(738, 300, 51)
    expect(fromPhotosDeep).toBe(fromTopOfPage)
    expect(fromMidHero).toBe(fromTopOfPage)
  })

  it('mobile Safari sized viewport (375x553 hero at min-h 520px floor)', () => {
    // min-h-[520px] wins over 85vh on short viewports; main at 520 + 51 nav.
    expect(contentScrollTop(520, 0, 51)).toBe(469)
  })

  it('never returns a negative scroll target', () => {
    expect(contentScrollTop(10, 0, 51)).toBe(0)
  })
})

describe('scrollBehaviorFor (prefers-reduced-motion, WCAG 2.3.3)', () => {
  it('smooth only under no-preference', () => {
    expect(scrollBehaviorFor(false)).toBe('smooth')
  })
  it('instant jump when the guest asked for reduced motion', () => {
    expect(scrollBehaviorFor(true)).toBe('auto')
  })
})

describe('isPlainLeftClick', () => {
  const plain: ClickModifiers = {
    defaultPrevented: false, metaKey: false, ctrlKey: false,
    shiftKey: false, altKey: false, button: 0,
  }

  it('accepts an unmodified primary click', () => {
    expect(isPlainLeftClick(plain)).toBe(true)
  })

  it('rejects modified and non-primary clicks (new tab/window must not scroll this page)', () => {
    expect(isPlainLeftClick({ ...plain, metaKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, ctrlKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, shiftKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, altKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, button: 1 })).toBe(false)
    expect(isPlainLeftClick({ ...plain, defaultPrevented: true })).toBe(false)
  })
})

describe('wiring: WeddingNav owns the scroll, layout provides the fallback margin', () => {
  it('nav tab Links disable Next default scroll and attach the explicit handler', () => {
    const src = read('app/wedding/[slug]/WeddingNav.tsx')
    expect(src).toContain('scroll={false}')
    expect(src).toContain('onClick={handleTabClick}')
    // The handler must respect reduced motion and measure the real nav height.
    expect(src).toContain('prefers-reduced-motion: reduce')
    expect(src).toContain('scrollBehaviorFor')
    expect(src).toContain('contentScrollTop')
    expect(src).toContain('isPlainLeftClick')
    expect(src).toContain('stickyRef')
  })

  it('<main> carries scroll-mt so any scrollIntoView fallback clears the sticky nav', () => {
    const src = read('app/wedding/[slug]/layout.tsx')
    expect(src).toMatch(/<main id="main" className="[^"]*scroll-mt-14[^"]*"/)
  })
})
