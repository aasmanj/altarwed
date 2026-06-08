import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useEffect } from 'react'
import {
  useVendorSubscription,
  useCreateCheckoutSession,
  useCreatePortalSession,
} from './useSubscription'
import PageHeader from '@/components/PageHeader'

export default function VendorSubscriptionPage() {
  const [searchParams] = useSearchParams()
  const { data: sub, isLoading } = useVendorSubscription()
  const checkout = useCreateCheckoutSession()
  const portal = useCreatePortalSession()

  useEffect(() => {
    if (searchParams.get('session') === 'success') {
      toast.success('Subscription activated! Welcome to AltarWed Pro.')
    }
  }, [searchParams])

  const isPro = sub?.planTier === 'FEATURED' || sub?.planTier === 'PREMIUM'
  const isActive = sub?.status === 'ACTIVE' || sub?.status === 'TRIALING'

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <PageHeader title="Subscription" backTo="/vendor" backLabel="Back to dashboard" maxWidth="max-w-2xl" />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        {isLoading ? (
          <div className="text-center text-[#a08060]">Loading...</div>
        ) : isPro && isActive ? (
          <ActivePlanPanel sub={sub!} onManage={() => portal.mutate()} managing={portal.isPending} />
        ) : sub?.status === 'PAST_DUE' ? (
          <PastDuePanel onManage={() => portal.mutate()} managing={portal.isPending} />
        ) : (
          <UpgradePanel
            monthlyPriceId={sub?.proMonthlyPriceId ?? null}
            annualPriceId={sub?.proAnnualPriceId ?? null}
            onCheckout={(priceId) => checkout.mutate(priceId)}
            loading={checkout.isPending}
          />
        )}
      </main>
    </div>
  )
}

function ActivePlanPanel({
  sub,
  onManage,
  managing,
}: {
  sub: { currentPeriodEnd: string | null }
  onManage: () => void
  managing: boolean
}) {
  const renewDate = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div className="rounded-2xl border border-[#d4af6a] bg-white p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl font-serif font-bold text-[#3b2f2f]">AltarWed Pro</span>
        <span className="text-xs font-semibold bg-[#d4af6a] text-white px-2.5 py-1 rounded-full">
          Active
        </span>
      </div>
      <p className="text-[#6b5344] text-sm mb-6">
        Your listing gets priority placement and detailed analytics.
        {renewDate && <> Renews {renewDate}.</>}
      </p>
      <button
        onClick={onManage}
        disabled={managing}
        className="text-sm font-medium text-[#d4af6a] hover:text-[#b8964e] transition disabled:opacity-50"
      >
        {managing ? 'Opening...' : 'Manage billing & cancellation →'}
      </button>
    </div>
  )
}

function PastDuePanel({ onManage, managing }: { onManage: () => void; managing: boolean }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white p-8">
      <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2">Payment past due</p>
      <p className="text-sm text-[#6b5344] mb-6">
        Your last payment failed. Update your payment method to restore Pro access.
      </p>
      <button
        onClick={onManage}
        disabled={managing}
        className="rounded-lg bg-[#3b2f2f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5c4033] transition disabled:opacity-50"
      >
        {managing ? 'Opening...' : 'Update payment method'}
      </button>
    </div>
  )
}

function UpgradePanel({
  monthlyPriceId,
  annualPriceId,
  onCheckout,
  loading,
}: {
  monthlyPriceId: string | null
  annualPriceId: string | null
  onCheckout: (priceId: string) => void
  loading: boolean
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">Upgrade to Pro</h2>
        <p className="text-[#a08060] text-sm">
          Get in front of more couples with priority placement and analytics.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e8dcc8] bg-white divide-y divide-[#e8dcc8]">
        <PricingRow
          label="Monthly"
          price="$29 / month"
          description="Billed monthly, cancel anytime"
          priceId={monthlyPriceId}
          onCheckout={onCheckout}
          loading={loading}
        />
        <PricingRow
          label="Annual"
          price="$290 / year"
          description="Save 2 months vs. monthly"
          badge="Best value"
          priceId={annualPriceId}
          onCheckout={onCheckout}
          loading={loading}
        />
      </div>

      <p className="text-xs text-[#a08060] text-center">
        Have a promo code? You can enter it on the checkout page.
        <br />
        No long-term commitment. Cancel anytime from your billing portal.
      </p>

      <div className="rounded-xl bg-[#fdf6eb] border border-[#e8dcc8] p-5">
        <p className="font-semibold text-[#3b2f2f] text-sm mb-2">What you get with Pro</p>
        <ul className="text-sm text-[#6b5344] space-y-1">
          <li>Priority placement in category &amp; city search</li>
          <li>Profile views and inquiry analytics</li>
          <li>Featured badge on your listing</li>
          <li>More photos and richer profile</li>
        </ul>
      </div>
    </div>
  )
}

function PricingRow({
  label,
  price,
  description,
  badge,
  priceId,
  onCheckout,
  loading,
}: {
  label: string
  price: string
  description: string
  badge?: string
  priceId: string | null
  onCheckout: (priceId: string) => void
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#3b2f2f]">{label}</span>
          {badge && (
            <span className="text-xs font-medium text-[#d4af6a] bg-[#d4af6a]/10 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-lg font-bold text-[#3b2f2f] mt-0.5">{price}</p>
        <p className="text-xs text-[#a08060]">{description}</p>
      </div>
      <button
        onClick={() => priceId && onCheckout(priceId)}
        disabled={loading || !priceId}
        className="shrink-0 rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition disabled:opacity-40"
      >
        {loading ? 'Loading...' : 'Subscribe'}
      </button>
    </div>
  )
}
