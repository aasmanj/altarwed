import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useEffect, useRef } from 'react'
import {
  useVendorSubscription,
  useCreateCheckoutSession,
  useCreatePortalSession,
} from './useSubscription'
import PromoCodeBox from './PromoCodeBox'
import { captureEvent } from '@/core/analytics/analytics'
import { trackSubscribe } from '@/core/analytics/metaPixel'
import { enableVendorAnalyticsIfConsented } from '@/core/analytics/vendorAnalytics'
import { PLAN_CURRENCY, planValueForPrice, takeCheckoutValue } from './planValue'

// Shown when a Stripe price ID fails to load (config/deploy skew) so a vendor ready
// to pay is not left at a silent dead-end with only a greyed-out button. See issue #154.
export const BILLING_UNAVAILABLE_MESSAGE =
  'Billing is temporarily unavailable, please try again shortly.'

// A price row is only actionable once its Stripe price ID has loaded. A null/empty
// price ID means we cannot start a checkout, so we surface the message above instead
// of silently disabling the button.
export function isBillingUnavailable(priceId: string | null | undefined): boolean {
  return !priceId
}

export default function VendorSubscriptionPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: sub, isLoading } = useVendorSubscription()
  const checkout = useCreateCheckoutSession()
  const portal = useCreatePortalSession()

  // Fire the activation conversion at most once per successful return. The
  // '?session=success' param persists in the address bar after the Stripe
  // redirect, so a refresh, back-nav, remount, or StrictMode double-invoke would
  // otherwise replay the un-dedupable Meta Subscribe conversion. The ref stops the
  // in-session replays; stripping the param keeps a hard refresh clean too.
  const firedActivation = useRef(false)

  useEffect(() => {
    if (searchParams.get('session') !== 'success') return
    if (firedActivation.current) return
    firedActivation.current = true

    toast.success('Subscription activated! Welcome to AltarWed Pro.')
    // subscription_activated is the vendor funnel's revenue conversion. Stripe
    // redirected the browser here, so module-level analytics state was reset;
    // re-boot for a consenting vendor before capturing, then fire Meta Subscribe
    // with the value stashed when checkout started (for value-based lookalikes).
    enableVendorAnalyticsIfConsented()
    const value = takeCheckoutValue()
    const valueProps = value !== null ? { value, currency: PLAN_CURRENCY } : undefined
    captureEvent('subscription_activated', valueProps)
    trackSubscribe(valueProps)

    // Strip the param so a refresh or shared/bookmarked URL does not look like a
    // fresh activation. replace: true so it does not add a history entry.
    const next = new URLSearchParams(searchParams)
    next.delete('session')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const isPro = sub?.planTier === 'FEATURED' || sub?.planTier === 'PREMIUM'
  const isActive = sub?.status === 'ACTIVE' || sub?.status === 'TRIALING'

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
        <Link to="/vendor" className="text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition">
          &larr; Dashboard
        </Link>
        <span className="text-[#e8dcc8]">|</span>
        <span className="font-serif text-lg font-semibold text-[#3b2f2f]">Subscription</span>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        {isLoading ? (
          <div className="text-center text-[#8a6a4a]">Loading...</div>
        ) : sub?.comped ? (
          // Comped must be checked before "active": a comp is an ACTIVE sub with no Stripe
          // customer, so the billing-portal panel below would not apply to it.
          <CompedPanel />
        ) : isPro && isActive ? (
          <ActivePlanPanel sub={sub!} onManage={() => portal.mutate()} managing={portal.isPending} />
        ) : sub?.status === 'PAST_DUE' ? (
          <PastDuePanel onManage={() => portal.mutate()} managing={portal.isPending} />
        ) : (
          <UpgradePanel
            monthlyPriceId={sub?.proMonthlyPriceId ?? null}
            annualPriceId={sub?.proAnnualPriceId ?? null}
            onCheckout={(priceId) =>
              checkout.mutate({
                priceId,
                planValue: planValueForPrice(
                  priceId,
                  sub?.proMonthlyPriceId ?? null,
                  sub?.proAnnualPriceId ?? null,
                ),
              })
            }
            loading={checkout.isPending}
            onRedeemed={() => toast.success('Your listing is now active. Welcome to AltarWed!')}
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

function CompedPanel() {
  return (
    <div className="rounded-2xl border border-[#d4af6a] bg-white p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl font-serif font-bold text-[#3b2f2f]">AltarWed Pro</span>
        <span className="text-xs font-semibold bg-[#d4af6a] text-white px-2.5 py-1 rounded-full">
          Comped
        </span>
      </div>
      <p className="text-[#6b5344] text-sm">
        Your listing is active on the house, no subscription needed. You get priority placement and
        analytics just like a Pro vendor. Thank you for being one of our first vendors.
      </p>
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
  onRedeemed,
}: {
  monthlyPriceId: string | null
  annualPriceId: string | null
  onCheckout: (priceId: string) => void
  loading: boolean
  onRedeemed: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">Upgrade to Pro</h1>
        <p className="text-[#8a6a4a] text-sm">
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

      <PromoCodeBox onRedeemed={onRedeemed} />

      <p className="text-xs text-[#8a6a4a] text-center">
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
        <p className="text-xs text-[#8a6a4a]">{description}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <button
          onClick={() => priceId && onCheckout(priceId)}
          disabled={loading || isBillingUnavailable(priceId)}
          className="rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition disabled:opacity-40"
        >
          {loading ? 'Loading...' : 'Subscribe'}
        </button>
        {isBillingUnavailable(priceId) && (
          <p role="alert" className="max-w-[11rem] text-right text-xs text-red-600">
            {BILLING_UNAVAILABLE_MESSAGE}
          </p>
        )}
      </div>
    </div>
  )
}
