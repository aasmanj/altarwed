'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode, type RefObject } from 'react'

// Shared full-screen photo viewer: prev/next nav, Escape to close, focus trap, click-backdrop
// to close. Used by the vendor portfolio viewer (VendorPageClient.tsx) and the wedding photos
// gallery (PhotoGalleryClient.tsx) so the a11y-critical bits (keyboard handling, focus return)
// are fixed in one place instead of drifting across two hand-maintained copies.
export function useLightbox(count: number) {
  const [index, setIndex] = useState<number | null>(null)

  const lightboxRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const prevIndexRef = useRef<number | null>(null)

  const open = useCallback((idx: number, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setIndex(idx)
  }, [])

  const close = useCallback(() => {
    setIndex(null)
    triggerRef.current?.focus()
  }, [])

  const goPrev = useCallback(() => {
    setIndex(i => i !== null ? (i - 1 + count) % count : null)
  }, [count])

  const goNext = useCallback(() => {
    setIndex(i => i !== null ? (i + 1) % count : null)
  }, [count])

  useEffect(() => {
    if (index === null) {
      prevIndexRef.current = null
      return
    }
    // Only move focus to the close button on initial open, not on every photo navigation,
    // otherwise a keyboard user pressing arrow -> Enter would have focus yanked away from
    // the nav button each time.
    if (prevIndexRef.current === null) {
      closeButtonRef.current?.focus()
    }
    prevIndexRef.current = index

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowLeft') { goPrev(); return }
      if (e.key === 'ArrowRight') { goNext(); return }
      if (e.key !== 'Tab') return
      const el = lightboxRef.current
      if (!el) return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
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

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, close, goPrev, goNext])

  return { index, open, close, goPrev, goNext, lightboxRef, closeButtonRef }
}

interface LightboxFrameProps {
  index: number
  count: number
  ariaLabel: string
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  lightboxRef: RefObject<HTMLDivElement>
  closeButtonRef: RefObject<HTMLButtonElement>
  children: ReactNode
}

// Chrome around the viewer (backdrop, close button, prev/next arrows, counter). The
// caller supplies the image + caption as children, since those differ per page (vendor
// portfolio photos have no framing; wedding photos apply the couple's crop to the grid
// but not to this full-size view, matching "the anchor opens the full, uncropped original").
export function LightboxFrame({
  index, count, ariaLabel, onClose, onPrev, onNext, lightboxRef, closeButtonRef, children,
}: LightboxFrameProps) {
  return (
    <div
      ref={lightboxRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute top-4 right-5 text-white/70 hover:text-white text-4xl leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        aria-label="Close viewer"
      >
        &times;
      </button>

      {count > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-full"
          aria-label="Previous photo"
        >
          &#8592;
        </button>
      )}

      <div
        className="px-16 sm:px-20 max-w-5xl w-full flex flex-col items-center gap-3"
        onClick={e => e.stopPropagation()}
      >
        {children}
        <p className="text-white/40 text-xs" aria-live="polite">
          {index + 1} / {count}
        </p>
      </div>

      {count > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-full"
          aria-label="Next photo"
        >
          &#8594;
        </button>
      )}
    </div>
  )
}
