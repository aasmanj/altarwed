import { useEffect, type ReactNode, type RefObject } from 'react'
import { motion, type Transition } from 'framer-motion'
import { useModalA11y } from '@/lib/useModalA11y'

// ─────────────────────────────────────────────────────────────────────────────
// Shared animated modal / drawer chrome (issue #301).
//
// Before this file, ConfirmDialog and the checklist add-task modal animated
// open/close and the other eleven dialogs in the app hard-popped like native
// browser alerts, including the publish-celebration ShareModal snapping open
// at the same instant its confetti fires. This wrapper is the one place that
// owns:
//   - the fade/scale motion values (lifted from ConfirmDialog, the first
//     dialog in the app to animate)
//   - AnimatePresence-driven exit (mount this at a call site already wrapped
//     in <AnimatePresence>, e.g. `<AnimatePresence>{open && <AnimatedModal
//     onClose={...}>...</AnimatedModal>}</AnimatePresence>`, mirroring
//     ConfirmProvider's own pattern)
//   - useModalA11y (Escape closes, focus moves in on open, focus returns to
//     the trigger on close)
//
// The app is wrapped in <MotionConfig reducedMotion="user"> (App.tsx), so
// every animation here is automatically reduced-motion safe with no extra
// work in this file.
//
// Purely presentational: this file does not know about any modal's form
// state, validation, or mutations. Each caller still owns its own fields,
// submit handlers, and API calls; only the chrome (backdrop, panel, motion,
// a11y wiring) moved here.
// ─────────────────────────────────────────────────────────────────────────────

export const MODAL_BACKDROP_TRANSITION: Transition = { duration: 0.12 }
export const MODAL_PANEL_TRANSITION: Transition = { duration: 0.14, ease: 'easeOut' }
export const DRAWER_PANEL_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' }

// A click only counts as "on the backdrop" when the mousedown target is the
// backdrop element itself, not something inside the panel that bubbled up.
// Exported as a pure function so it is unit-testable without a DOM (this
// workspace's vitest runs in a node environment; see AnimatedModal.test.ts).
export function isBackdropClick(e: { target: unknown; currentTarget: unknown }): boolean {
  return e.target === e.currentTarget
}

// Tab-key focus trap, layered on top of useModalA11y's Escape + initial/restore
// focus. useModalA11y deliberately does not trap Tab (see its own comment);
// this is opt-in via `trapFocus` for the one modal that already trapped Tab
// before this wrapper existed (WebsiteSectionDrawer), so migrating it here
// does not regress that behavior.
function useTabTrap(containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === containerRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, containerRef])
}

interface AnimatedModalProps {
  onClose: () => void
  children: ReactNode
  /** Flex alignment/padding for the panel inside the fixed backdrop, e.g. "items-center justify-center p-4" or "items-end sm:items-center justify-center p-0 sm:p-4". */
  containerClassName?: string
  /** Backdrop tint. Modals in this app use bg-black/40, /50, /60, or /90 depending on content. */
  backdropClassName?: string
  panelClassName?: string
  /** Defaults to z-50, matching every modal except ConfirmDialog (z-[60], sits above everything else). */
  zIndexClassName?: string
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  trapFocus?: boolean
}

// Fade backdrop + fade/scale panel. Mount inside an <AnimatePresence> at the
// call site so closing plays the exit transition instead of hard-unmounting;
// do not also add an AnimatePresence inside a modal that uses this wrapper,
// or the exit will fire twice.
export function AnimatedModal({
  onClose,
  children,
  containerClassName = 'items-center justify-center p-4',
  backdropClassName = 'bg-black/40',
  panelClassName = '',
  zIndexClassName = 'z-50',
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  trapFocus = false,
}: AnimatedModalProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)
  useTabTrap(dialogRef, trapFocus)

  return (
    <motion.div
      className={`fixed inset-0 ${zIndexClassName} flex ${containerClassName} ${backdropClassName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MODAL_BACKDROP_TRANSITION}
      onMouseDown={e => { if (isBackdropClick(e)) onClose() }}
    >
      <motion.div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={`relative ${panelClassName}`}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={MODAL_PANEL_TRANSITION}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

interface AnimatedDrawerProps {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  backdropClassName?: string
  zIndexClassName?: string
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  trapFocus?: boolean
}

// Slide-over variant: backdrop fades in place, panel slides in from the right
// edge instead of scaling in the center. Used for WebsiteSectionDrawer, the
// one dialog in the app whose own comment already called it a "slide-over"
// before it actually slid.
export function AnimatedDrawer({
  onClose,
  children,
  panelClassName = 'w-full max-w-md',
  backdropClassName = 'bg-black/30',
  zIndexClassName = 'z-50',
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  trapFocus = false,
}: AnimatedDrawerProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)
  useTabTrap(dialogRef, trapFocus)

  return (
    <motion.div
      className={`fixed inset-0 ${zIndexClassName} flex justify-end ${backdropClassName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MODAL_BACKDROP_TRANSITION}
      onMouseDown={e => { if (isBackdropClick(e)) onClose() }}
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={`relative bg-white h-full shadow-2xl flex flex-col outline-none ${panelClassName}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={DRAWER_PANEL_TRANSITION}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
