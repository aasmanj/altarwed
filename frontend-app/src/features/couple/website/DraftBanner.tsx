import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

// sessionStorage (not localStorage): a dismissal only lasts the current browser
// session so the reminder returns on the couple's next visit until they actually
// publish. An unpublished site earns zero SEO and zero viral traffic, so nagging
// once per session is the deliberate cost of a persistent draft.
const DISMISS_KEY = 'editor.draftBannerDismissed'

// Pure display predicate, extracted so it can be unit-tested without a DOM
// (frontend-app's vitest runs in a node environment with no jsdom). Encodes the
// two acceptance rules: never show once published, otherwise show until the
// couple dismisses it for this session.
export function shouldShowDraftBanner(isPublished: boolean, dismissed: boolean): boolean {
  return !isPublished && !dismissed
}

interface Props {
  isPublished: boolean
  // Reuses the editor's existing publish flow (confetti + share prompt); the
  // banner only renders while the site is a draft, so this always publishes.
  onPublish: () => void
  isPublishing: boolean
}

export default function DraftBanner({ isPublished, onPublish, isPublishing }: Props) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === 'true',
  )

  if (!shouldShowDraftBanner(isPublished, dismissed)) return null

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      /* sessionStorage can throw in private mode; dismissing in-memory is enough */
    }
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-3 text-sm text-amber-900"
    >
      <AlertCircle size={16} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 leading-snug">
        <span className="font-semibold">Your site is a draft.</span>{' '}
        Guests can&rsquo;t see it yet. Publish to share your wedding website.
      </p>
      <button
        onClick={onPublish}
        disabled={isPublishing}
        className="flex-shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {isPublishing ? 'Publishing…' : 'Publish now'}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss draft reminder for this session"
        className="flex-shrink-0 text-amber-600 hover:text-amber-900 leading-none text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
      >
        &times;
      </button>
    </div>
  )
}
