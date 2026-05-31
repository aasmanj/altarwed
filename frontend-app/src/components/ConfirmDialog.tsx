import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Reusable confirm dialog
//
// Replaces the browser-native window.confirm() everywhere in the app. Native
// confirm() is un-stylable, blocks the JS thread, and reads as an amateur
// side-project to a couple about to spend money. This gives one on-brand,
// accessible (WCAG 2.1 AA) dialog driven by a promise:
//
//   const confirm = useConfirm()
//   if (await confirm({ title: 'Remove guest?', tone: 'danger' })) { ...delete... }
//
// Accessibility (per the project Accessibility Rules):
//   - role="alertdialog" + aria-modal, labelled/described by its own nodes
//   - focus moves into the dialog on open, is trapped while open (Tab cycles),
//     and returns to the trigger element on close
//   - Escape cancels; backdrop click cancels
//   - the safe action (Cancel) is focused by default so an accidental Enter
//     never confirms a destructive/expensive action
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string
  /** Body text. Optional, kept short. */
  message?: string
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string
  /**
   * 'danger' = red confirm button + warning icon (deletes, irreversible spends).
   * 'default' = brand-gold confirm button + info icon.
   */
  tone?: 'danger' | 'default'
}

type Resolver = (confirmed: boolean) => void

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<Resolver | null>(null)
  // Element that had focus before the dialog opened, restored on close.
  const triggerRef = useRef<HTMLElement | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    // If a dialog is somehow already open (overlapping calls), resolve the prior
    // promise as cancelled before replacing it, so its awaiter never hangs.
    resolverRef.current?.(false)
    triggerRef.current = document.activeElement as HTMLElement | null
    setOptions(opts)
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
    })
  }, [])

  // If the provider unmounts (e.g. a route change) while a dialog is open,
  // resolve the pending promise as cancelled rather than leaking it forever.
  useEffect(() => {
    return () => {
      resolverRef.current?.(false)
      resolverRef.current = null
    }
  }, [])

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setOptions(null)
    // Return focus to whatever opened the dialog (the Tab order is preserved
    // for keyboard users, and screen readers re-announce the trigger context).
    triggerRef.current?.focus?.()
    triggerRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {options && (
          <ConfirmDialog options={options} onResolve={close} />
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ options, onResolve }: { options: ConfirmOptions; onResolve: (v: boolean) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const danger = options.tone === 'danger'

  // Focus the safe (Cancel) button on open.
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Keyboard handling: Escape cancels, Tab is trapped inside the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onResolve(false)
        return
      }
      if (e.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onResolve])

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onResolve(false) }}
    >
      <motion.div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? 'confirm-message' : undefined}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
      >
        <div className="flex gap-4">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
            }`}
            aria-hidden="true"
          >
            {danger ? <AlertTriangle size={20} /> : <Info size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="font-serif text-lg font-bold text-brown">
              {options.title}
            </h2>
            {options.message && (
              <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-stone-600">
                {options.message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                : 'bg-gold hover:bg-gold-dark focus-visible:ring-gold'
            }`}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Returns an async `confirm(options)` that resolves true if the user confirms,
 * false otherwise. Must be called under a <ConfirmProvider>.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
