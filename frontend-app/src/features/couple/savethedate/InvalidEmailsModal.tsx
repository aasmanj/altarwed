import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

interface InvalidEmail {
  guestId: string
  name: string
  email: string
}

/**
 * Lists the guest email addresses that were skipped because they are malformed,
 * so the couple can correct them at the source. Accessible per the project rules:
 * role="dialog" + aria-modal, Escape and backdrop click close, focus moves to the
 * close button on open. One bad address would otherwise 422 a whole Resend batch,
 * which is why we surface the exact rows to fix rather than failing silently.
 */
export default function InvalidEmailsModal({
  emails,
  onClose,
}: {
  emails: InvalidEmail[]
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invalid-emails-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Sibling backdrop: aria-hidden so it is exempt from the interactive-element
          a11y rule, while still closing the modal on click. */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex gap-4">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
            aria-hidden="true"
          >
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="invalid-emails-title" className="font-serif text-lg font-bold text-brown">
              {emails.length} email address{emails.length !== 1 ? 'es' : ''} need fixing
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              We skipped these because the addresses are not valid, so no save-the-date was sent
              to them. Fix them in your Google Sheet and re-sync your guest list (or edit each
              guest directly), then send again.
            </p>
          </div>
        </div>

        <ul className="mt-4 max-h-56 overflow-y-auto divide-y divide-stone-100 rounded-lg border border-stone-200">
          {emails.map(e => (
            <li key={e.guestId} className="px-3 py-2">
              <p className="text-sm font-medium text-stone-800">{e.name}</p>
              <p className="text-xs text-rose-600 break-all">{e.email}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <Link
            to="/dashboard/guests"
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            Go to guest list
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
