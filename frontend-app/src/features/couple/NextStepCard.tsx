import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Guest } from '@/features/couple/guests/useGuests'
import type { GuestStats } from '@/features/couple/guests/guestStats'
import { computeNextStep, dismissalStorageKey } from '@/features/couple/nextStep'

interface Props {
  coupleId: string
  guests: Guest[]
  stats: GuestStats
}

// "What's next" nudge shown after a couple publishes their site, closing the guidance gap
// between publish and the guest funnel. It renders nothing on its own data fetch: the caller
// (AtAGlanceCard) passes the guests/stats it already loaded, so this adds no API calls.
//
// Dismissal is persisted per couple + per stage in localStorage (see dismissalStorageKey), so
// hiding one nudge only hides that stage; the card returns as soon as the couple advances.
export default function NextStepCard({ coupleId, guests, stats }: Props) {
  const nudge = computeNextStep(guests, stats)

  // Read once on mount whether the current stage was already dismissed. Keyed off the stage so
  // a stage change re-evaluates to "not dismissed" naturally. localStorage can throw (private
  // mode / disabled storage); treat any failure as "not dismissed" rather than crashing the card.
  const [dismissed, setDismissed] = useState(() => {
    if (!nudge) return false
    try {
      return localStorage.getItem(dismissalStorageKey(coupleId, nudge.stage)) === '1'
    } catch {
      return false
    }
  })

  if (!nudge || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(dismissalStorageKey(coupleId, nudge.stage), '1')
    } catch {
      // Non-fatal: if we cannot persist, still hide it for this session.
    }
    setDismissed(true)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gold-light bg-gradient-to-r from-ivory to-white px-4 py-3">
      <span className="inline-block w-2 h-2 rounded-full bg-gold shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-brown-light">Next step</span>
        <span className="block text-sm font-medium text-brown">{nudge.message}</span>
      </div>
      <Link
        to={nudge.href}
        className="shrink-0 rounded-lg bg-[#d4af6a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c49d55] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {nudge.ctaLabel} &rarr;
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss this suggestion"
        className="shrink-0 rounded-lg p-1.5 text-brown-light hover:bg-ivory hover:text-brown transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
