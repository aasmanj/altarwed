import { useEffect, useRef } from 'react'

// Shared modal accessibility, mirroring the established ShareModal pattern:
//   - Escape closes the dialog (WCAG 2.1.2 Keyboard)
//   - focus moves to the first focusable control when it opens
//   - focus returns to the triggering element when it closes (WCAG 2.4.3)
//
// Deliberately NOT a full Tab focus-trap: nothing in this codebase traps yet,
// and a half-correct trap is worse than none. This covers the basics the UX
// audit flagged.
//
// onClose is read through a ref so passing an inline arrow (a fresh identity on
// every render) does not re-run the effect and yank focus while the user types
// in the modal. The effect keys only on `isOpen`.
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)

    // Focus the first focusable control inside the dialog.
    const first = containerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()

    return () => {
      window.removeEventListener('keydown', onKey)
      // Don't strand keyboard users at the top of the page after closing.
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  return containerRef
}
