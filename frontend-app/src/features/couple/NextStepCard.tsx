import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Guest } from '@/features/couple/guests/useGuests'
import type { GuestStats } from '@/features/couple/guests/guestStats'
import { computeNextStep, dismissalStorageKey, readDismissed } from '@/features/couple/nextStep'

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
  const stage = nudge?.stage

  // Seed from storage on first paint so a previously dismissed nudge does not flash before an
  // effect can hide it.
  const [dismissed, setDismissed] = useState(() =>
    stage ? readDismissed(coupleId, stage, browserStorage()) : false,
  )

  // Re-sync whenever the couple advances to a new stage in place. React Query can update the
  // shared guests cache on window refocus without remounting this card, so the lazy initializer
  // above would otherwise keep the previous stage's "dismissed" value and wrongly suppress the
  // new stage's nudge. Re-reading per stage fixes that. Dismissing within a stage does not change
  // these deps, so this effect never re-shows a nudge the couple just dismissed.
  useEffect(() => {
    setDismissed(stage ? readDismissed(coupleId, stage, browserStorage()) : false)
  }, [coupleId, stage])

  if (!nudge || dismissed) return null

  const dismiss = () => {
    const storage = browserStorage()
    try {
      storage?.setItem(dismissalStorageKey(coupleId, nudge.stage), '1')
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
        {nudge.ctaLabel} →
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

// localStorage, or null when it is unavailable (SSR, private mode, or a security policy that
// throws on access). Callers treat null as "nothing persisted".
function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}
