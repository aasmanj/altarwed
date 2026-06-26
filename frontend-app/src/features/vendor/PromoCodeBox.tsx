import { useState } from 'react'
import { useRedeemPromo } from './useSubscription'

/**
 * Collapsible "Have a promo code?" box. Redeems a comp code server-side to publish the vendor's
 * listing for free (no Stripe). Shared by the signup "Your account is ready" step and the vendor
 * subscription page. Calls onRedeemed after a successful redemption so the host can navigate or
 * refresh.
 */
export default function PromoCodeBox({ onRedeemed }: { onRedeemed?: () => void }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const redeem = useRedeemPromo()

  async function apply() {
    setError('')
    try {
      await redeem.mutateAsync(code.trim())
      onRedeemed?.()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Could not apply that code. Please try again.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition py-2 underline underline-offset-2"
      >
        Have a promo code?
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-4 space-y-2">
      <label htmlFor="promo-code" className="block text-sm font-medium text-[#3b2f2f]">
        Promo code
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
          autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
          className="flex-1 rounded-lg border border-[#e8dcc8] px-3 py-2 text-sm text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
        />
        <button
          type="button"
          onClick={apply}
          disabled={!code.trim() || redeem.isPending}
          className="shrink-0 rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition disabled:opacity-40"
        >
          {redeem.isPending ? 'Applying...' : 'Apply'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
