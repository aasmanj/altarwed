import { AlertCircle } from 'lucide-react'

interface Props {
  // Plain-language description of what failed to load, e.g. "your budget".
  // Kept generic so a network blip never tells a couple their data is gone.
  what?: string
  onRetry?: () => void
}

// Shared full-section error state for React Query failures. Distinct from an
// empty state on purpose: a failed fetch must never render as "you have no X",
// which would imply the couple's data was lost and invite duplicate re-entry.
export default function QueryErrorState({ what = 'this', onRetry }: Props) {
  return (
    <div
      role="alert"
      className="bg-white rounded-xl border border-stone-200 p-10 text-center"
    >
      <AlertCircle className="w-10 h-10 mx-auto mb-4 text-rose-400" strokeWidth={1.5} />
      <h3 className="text-lg font-medium text-stone-800 mb-1">
        We couldn&rsquo;t load {what}
      </h3>
      <p className="text-stone-500 text-sm mb-6">
        Something went wrong on our end, not on yours. Your information is safe.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-brown hover:bg-gold-dark transition"
        >
          Try again
        </button>
      )}
    </div>
  )
}
