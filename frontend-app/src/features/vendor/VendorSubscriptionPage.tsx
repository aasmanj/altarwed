import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useEffect, useId, useRef, useState } from 'react'
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

// Clear-and-conspicuous auto-renewal disclosure shown adjacent to the Subscribe button
// before any recurring charge is captured. Required by the FTC Negative Option Rule and
// California's Automatic Renewal Law (Cal. Bus. & Prof. Code S17600 et seq.), which both
// require the recurring price, the renewal cadence, and how to cancel to be disclosed
// up front, plus affirmative consent to the recurring charge.
//
// NOTE: the exact legal wording here is pending attorney review (see issue #386). Treat
// this copy as a placeholder that counsel must confirm before the marketing push.
export const AUTO_RENEWAL_DISCLOSURE_HEADING = 'Automatic renewal terms'

// Shared tail of the disclosure: renewal-until-cancel and how to cancel, identical for every
// rung of the pricing ladder (issue #370), so the negative-option disclosure from PR #402
// applies to ALL tiers, not just Pro.
const AUTO_RENEWAL_DISCLOSURE_TAIL =
  'Billing recurs at the same price each period and ' +
  'continues until you cancel. You can cancel anytime from the billing portal on this ' +
  'Subscription page; cancellation takes effect at the end of the current billing period, and ' +
  'partial periods are not refunded.'

// The disclosure must name the recurring price and cadence of every plan the vendor can buy on
// this page (FTC Negative Option Rule / CA ARL). With the Premium tier unconfigured this returns
// the exact pre-ladder Pro-only copy, pinning the "blank config = current UI" invariant.
export function buildAutoRenewalDisclosureBody(premiumConfigured: boolean): string {
  if (!premiumConfigured) {
    return (
      'Your AltarWed Pro subscription renews automatically. The monthly plan bills $29 every month; ' +
      'the annual plan bills $290 every year. ' + AUTO_RENEWAL_DISCLOSURE_TAIL
    )
  }
  return (
    'Your AltarWed subscription renews automatically. The Pro monthly plan bills $29 every month; ' +
    'the Pro annual plan bills $290 every year. The Premium monthly plan bills $79 every month; ' +
    'the Premium annual plan bills $790 every year. ' + AUTO_RENEWAL_DISCLOSURE_TAIL
  )
}

export function buildAutoRenewalConsentLabel(premiumConfigured: boolean): string {
  const planName = premiumConfigured ? 'AltarWed' : 'AltarWed Pro'
  return (
    `I understand my ${planName} subscription renews automatically at the price and interval ` +
    'shown above, and I authorize AltarWed to charge my payment method on a recurring basis until ' +
    'I cancel.'
  )
}

export const AUTO_RENEWAL_DISCLOSURE_BODY = buildAutoRenewalDisclosureBody(false)

export const AUTO_RENEWAL_CONSENT_LABEL = buildAutoRenewalConsentLabel(false)

// Issue #370 pricing ladder: the Premium tier renders only once at least one of its Stripe price
// ids is configured. Until Jordan creates the Premium prices (a founder pricing decision), this
// is false everywhere and the page renders exactly the single-tier Pro UI it always has: graceful
// absence, the same pattern as isBillingUnavailable below.
export function isPremiumTierConfigured(
  premiumMonthlyPriceId: string | null | undefined,
  premiumAnnualPriceId: string | null | undefined,
): boolean {
  return !!premiumMonthlyPriceId || !!premiumAnnualPriceId
}

// Checkout may only begin once a valid Stripe price ID has loaded AND the vendor has given
// affirmative consent to the recurring charge (negative-option compliance) AND no checkout
// is already in flight. Centralised so the buttons and the tests agree on the exact gate.
export function canStartCheckout(
  priceId: string | null | undefined,
  consented: boolean,
  loading: boolean,
): boolean {
  return !!priceId && consented && !loading
}

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
          <ActivePlanPanel
            sub={sub!}
            premiumConfigured={isPremiumTierConfigured(sub?.premiumMonthlyPriceId, sub?.premiumAnnualPriceId)}
            onManage={() => portal.mutate()}
            managing={portal.isPending}
          />
        ) : sub?.status === 'PAST_DUE' ? (
          <PastDuePanel onManage={() => portal.mutate()} managing={portal.isPending} />
        ) : (
          <UpgradePanel
            monthlyPriceId={sub?.proMonthlyPriceId ?? null}
            annualPriceId={sub?.proAnnualPriceId ?? null}
            premiumMonthlyPriceId={sub?.premiumMonthlyPriceId ?? null}
            premiumAnnualPriceId={sub?.premiumAnnualPriceId ?? null}
            onCheckout={(priceId) =>
              checkout.mutate({
                priceId,
                planValue: planValueForPrice(priceId, {
                  proMonthly: sub?.proMonthlyPriceId ?? null,
                  proAnnual: sub?.proAnnualPriceId ?? null,
                  premiumMonthly: sub?.premiumMonthlyPriceId ?? null,
                  premiumAnnual: sub?.premiumAnnualPriceId ?? null,
                }),
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
  premiumConfigured,
  onManage,
  managing,
}: {
  sub: { currentPeriodEnd: string | null; planTier?: 'BASIC' | 'FEATURED' | 'PREMIUM' }
  premiumConfigured: boolean
  onManage: () => void
  managing: boolean
}) {
  const renewDate = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null
  const isPremium = sub.planTier === 'PREMIUM'

  return (
    <div className="rounded-2xl border border-[#d4af6a] bg-white p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl font-serif font-bold text-[#3b2f2f]">
          {isPremium ? 'AltarWed Premium' : 'AltarWed Pro'}
        </span>
        <span className="text-xs font-semibold bg-[#d4af6a] text-white px-2.5 py-1 rounded-full">
          Active
        </span>
      </div>
      <p className="text-[#6b5344] text-sm mb-6">
        {isPremium
          ? 'Your listing ranks at the top of its category with an expanded portfolio and detailed analytics.'
          : 'Your listing gets priority placement and detailed analytics.'}
        {renewDate && <> Renews {renewDate}.</>}
      </p>
      {!isPremium && premiumConfigured && (
        <p className="text-[#8a6a4a] text-xs mb-4">
          Want top-of-category placement and a bigger portfolio? Switch to Premium from the
          billing portal below.
        </p>
      )}
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
  premiumMonthlyPriceId,
  premiumAnnualPriceId,
  onCheckout,
  loading,
  onRedeemed,
}: {
  monthlyPriceId: string | null
  annualPriceId: string | null
  premiumMonthlyPriceId: string | null
  premiumAnnualPriceId: string | null
  onCheckout: (priceId: string) => void
  loading: boolean
  onRedeemed: () => void
}) {
  // Affirmative consent to the recurring charge. Checkout stays gated behind this so we
  // never send a vendor to Stripe without capturing negative-option consent first. One
  // consent covers the whole ladder: the disclosure body names every purchasable plan's
  // price and cadence, so the consent is informed for whichever plan the vendor picks.
  const [consented, setConsented] = useState(false)
  const disclosureId = useId()
  const consentId = useId()
  const premiumConfigured = isPremiumTierConfigured(premiumMonthlyPriceId, premiumAnnualPriceId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">
          {premiumConfigured ? 'Choose your plan' : 'Upgrade to Pro'}
        </h1>
        <p className="text-[#8a6a4a] text-sm">
          Get in front of more couples with priority placement and analytics.
        </p>
      </div>

      <div
        id={disclosureId}
        className="rounded-xl border border-[#d4af6a] bg-[#fdf6eb] p-5"
      >
        <p className="font-semibold text-[#3b2f2f] text-sm mb-1">
          {AUTO_RENEWAL_DISCLOSURE_HEADING}
        </p>
        <p className="text-sm text-[#6b5344]">{buildAutoRenewalDisclosureBody(premiumConfigured)}</p>
        <label htmlFor={consentId} className="mt-4 flex items-start gap-2.5 cursor-pointer">
          <input
            id={consentId}
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#3b2f2f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
          />
          <span className="text-sm text-[#3b2f2f]">{buildAutoRenewalConsentLabel(premiumConfigured)}</span>
        </label>
      </div>

      <div className="rounded-2xl border border-[#e8dcc8] bg-white divide-y divide-[#e8dcc8]">
        {premiumConfigured && (
          <p className="px-5 pt-4 pb-1 text-sm font-semibold text-[#3b2f2f]">Pro</p>
        )}
        <PricingRow
          label="Monthly"
          price="$29 / month"
          description="Billed monthly, cancel anytime"
          priceId={monthlyPriceId}
          onCheckout={onCheckout}
          loading={loading}
          consented={consented}
          disclosureId={disclosureId}
        />
        <PricingRow
          label="Annual"
          price="$290 / year"
          description="Save 2 months vs. monthly"
          badge="Best value"
          priceId={annualPriceId}
          onCheckout={onCheckout}
          loading={loading}
          consented={consented}
          disclosureId={disclosureId}
        />
      </div>

      {premiumConfigured && (
        <div className="rounded-2xl border border-[#d4af6a] bg-white divide-y divide-[#e8dcc8]">
          <p className="px-5 pt-4 pb-1 text-sm font-semibold text-[#3b2f2f]">Premium</p>
          <PricingRow
            label="Monthly"
            price="$79 / month"
            description="Billed monthly, cancel anytime"
            priceId={premiumMonthlyPriceId}
            onCheckout={onCheckout}
            loading={loading}
            consented={consented}
            disclosureId={disclosureId}
          />
          <PricingRow
            label="Annual"
            price="$790 / year"
            description="Save 2 months vs. monthly"
            badge="Top placement"
            priceId={premiumAnnualPriceId}
            onCheckout={onCheckout}
            loading={loading}
            consented={consented}
            disclosureId={disclosureId}
          />
        </div>
      )}

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

      {premiumConfigured && (
        <div className="rounded-xl bg-[#fdf6eb] border border-[#d4af6a] p-5">
          <p className="font-semibold text-[#3b2f2f] text-sm mb-2">What you get with Premium</p>
          <ul className="text-sm text-[#6b5344] space-y-1">
            <li>Everything in Pro</li>
            <li>Top-of-category placement: Premium listings rank first in your category and city</li>
            <li>Expanded portfolio: up to 25 photos (Pro includes 10)</li>
          </ul>
        </div>
      )}
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
  consented,
  disclosureId,
}: {
  label: string
  price: string
  description: string
  badge?: string
  priceId: string | null
  onCheckout: (priceId: string) => void
  loading: boolean
  consented: boolean
  disclosureId: string
}) {
  const ready = canStartCheckout(priceId, consented, loading)
  // Consent is only "missing" once the price row is otherwise usable, so we do not nag
  // the vendor with a consent hint while billing is unavailable for a different reason.
  const needsConsent = !consented && !isBillingUnavailable(priceId) && !loading

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
          onClick={() => ready && priceId && onCheckout(priceId)}
          disabled={!ready}
          aria-describedby={disclosureId}
          className="rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition disabled:opacity-40"
        >
          {loading ? 'Loading...' : 'Subscribe'}
        </button>
        {isBillingUnavailable(priceId) ? (
          <p role="alert" className="max-w-[11rem] text-right text-xs text-red-600">
            {BILLING_UNAVAILABLE_MESSAGE}
          </p>
        ) : needsConsent ? (
          <p className="max-w-[11rem] text-right text-xs text-[#8a6a4a]">
            Confirm the automatic renewal terms above to continue.
          </p>
        ) : null}
      </div>
    </div>
  )
}
