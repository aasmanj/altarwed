import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the library at the module boundary so no real canvas is touched and we can
// assert purely on whether fireConfetti forwarded the call. vi.hoisted keeps the
// spy available inside the hoisted vi.mock factory.
const { confettiSpy } = vi.hoisted(() => ({ confettiSpy: vi.fn() }))
vi.mock('canvas-confetti', () => ({ default: confettiSpy }))

import { fireConfetti, prefersReducedMotion } from './fireConfetti'

// Install a matchMedia stub that reports the given reduced-motion preference. The
// helper reads window.matchMedia, so we stub it on the global for the node test env.
function stubMatchMedia(reduced: boolean): ReturnType<typeof vi.fn> {
  const mql = vi.fn((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('window', { matchMedia: mql })
  return mql
}

describe('fireConfetti (prefers-reduced-motion, #306)', () => {
  beforeEach(() => {
    confettiSpy.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no-ops when the user has requested reduced motion', () => {
    stubMatchMedia(true)
    fireConfetti({ particleCount: 200 })
    expect(confettiSpy).not.toHaveBeenCalled()
  })

  it('fires with the given options when reduced motion is not requested', () => {
    stubMatchMedia(false)
    const opts = { particleCount: 120, spread: 80 }
    fireConfetti(opts)
    expect(confettiSpy).toHaveBeenCalledTimes(1)
    expect(confettiSpy).toHaveBeenCalledWith(opts)
  })

  it('queries the reduced-motion media feature exactly once per call', () => {
    const mql = stubMatchMedia(false)
    fireConfetti()
    expect(mql).toHaveBeenCalledTimes(1)
    expect(mql).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('fires when matchMedia is unavailable (non-browser context) rather than throwing', () => {
    vi.stubGlobal('window', {})
    expect(() => fireConfetti()).not.toThrow()
    expect(confettiSpy).toHaveBeenCalledTimes(1)
  })

  it('prefersReducedMotion reflects the media query result', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})
