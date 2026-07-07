// Pure helpers for the sticky wedding nav's tab-click scroll handling
// (issue #298). Kept free of React/Next/DOM imports so vitest can unit-test
// the logic in this workspace's plain node environment (no jsdom).

/**
 * Absolute document Y position the viewport should scroll to so the tab
 * content's top edge lands exactly below the sticky nav instead of hidden
 * underneath it (or way up above the 85vh hero).
 *
 * mainViewportTop + currentScrollY is <main>'s absolute document position;
 * subtracting the nav's rendered height yields the scroll offset at which the
 * sticky nav is pinned to the viewport top with the content starting right
 * below it. Clamped at 0 so a degenerate layout can never produce a negative
 * scroll target.
 */
export function contentScrollTop(
  mainViewportTop: number,
  currentScrollY: number,
  navHeight: number,
): number {
  return Math.max(0, mainViewportTop + currentScrollY - navHeight)
}

/**
 * WCAG 2.3.3 (Animation from Interactions): animate the scroll only when the
 * guest has not asked the OS for reduced motion; otherwise jump instantly.
 */
export function scrollBehaviorFor(prefersReducedMotion: boolean): 'auto' | 'smooth' {
  return prefersReducedMotion ? 'auto' : 'smooth'
}

/** The subset of a mouse click event the guard below needs. */
export interface ClickModifiers {
  defaultPrevented: boolean
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  button: number
}

/**
 * True only for an unmodified primary-button click. Cmd/Ctrl/Shift/middle
 * clicks open the link in a new tab or window, so the CURRENT page must not
 * scroll; a defaultPrevented event means something else already handled it.
 */
export function isPlainLeftClick(e: ClickModifiers): boolean {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  )
}
