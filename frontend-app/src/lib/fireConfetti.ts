import confetti from 'canvas-confetti'

// The options bag canvas-confetti's default export accepts. Derived from the
// function signature so it stays in lock-step with the installed types without
// depending on the library's internal namespace name.
export type ConfettiOptions = Parameters<typeof confetti>[0]

// True when the OS/browser has requested reduced motion. Guarded for non-browser
// contexts (SSR, unit tests without a DOM) where window/matchMedia may be absent,
// in which case we treat motion as allowed and let the real environment decide.
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Single entry point for every celebration burst. Checks prefers-reduced-motion
// once per call and no-ops when the user asked to reduce motion, so the app-wide
// accessibility contract holds without each call site re-implementing the guard.
export function fireConfetti(opts?: ConfettiOptions): void {
  if (prefersReducedMotion()) return
  confetti(opts)
}
