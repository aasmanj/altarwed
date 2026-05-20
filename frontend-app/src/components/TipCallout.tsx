import { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import type { Tip } from '@/lib/tips'

interface Props {
  tip: Tip
  dismissable?: boolean
}

// Inline tip used to coach couples without nagging. Dismissals are sticky per
// tip id via localStorage so the same tip never re-appears for a given user.
export default function TipCallout({ tip, dismissable = true }: Props) {
  const storageKey = `tip.dismissed.${tip.id}`
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === '1',
  )

  if (dismissed) return null

  return (
    <div className="relative rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 text-sm text-stone-800">
      <Lightbulb size={16} className="flex-shrink-0 text-amber-600 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-stone-900">{tip.title}</p>
        <p className="text-stone-700 mt-0.5">{tip.body}</p>
      </div>
      {dismissable && (
        <button
          onClick={() => {
            window.localStorage.setItem(storageKey, '1')
            setDismissed(true)
          }}
          aria-label="Dismiss tip"
          className="flex-shrink-0 text-amber-700/70 hover:text-amber-900 self-start"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
