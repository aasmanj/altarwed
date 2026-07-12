import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'
import { captureEvent } from '@/core/analytics/analytics'
import { trackInitiateCheckout } from '@/core/analytics/metaPixel'
import { enableVendorAnalyticsIfConsented } from '@/core/analytics/vendorAnalytics'

// Actionable fallbacks for the two money-path mutations (issue #296). When the backend
// sends an RFC 7807 ProblemDetail we surface its `detail` verbatim; otherwise (5xx,
// timeout, network blip) the vendor still gets a concrete next step instead of silence.
export const CHECKOUT_ERROR_MESSAGE = 'Could not open checkout. Please try again.'
export const PORTAL_ERROR_MESSAGE = 'Could not open billing management. Please try again.'

export interface SubscriptionInfo {
  planTier: 'BASIC' | 'FEATURED' | 'PREMIUM'
  status: 'NONE' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING'
  currentPeriodEnd: string | null
  proMonthlyPriceId: string | null
  proAnnualPriceId: string | null
  // True when the listing was comped via a promo code (no Stripe). Drives the "Comped" UI and
  // hides billing management, since a comped vendor has no Stripe customer to manage.
  comped: boolean
}

export function useVendorSubscription() {
  return useQuery<SubscriptionInfo>({
    queryKey: ['vendor', 'subscription'],
    queryFn: () => apiClient.get('/api/v1/vendors/me/subscription').then(r => r.data),
  })
}

export function useCreateCheckoutSession() {
  return useMutation({
    // checkout_started is the vendor funnel's paid-intent signal. Fire it (plus
    // Meta's InitiateCheckout) before we navigate away to Stripe. Both are gated
    // on the vendor's opt-in; enableVendorAnalyticsIfConsented re-boots analytics
    // for this page load (module state is lost across the earlier redirect chain).
    onMutate: (priceId: string) => {
      enableVendorAnalyticsIfConsented()
      captureEvent('checkout_started', { price_id: priceId })
      trackInitiateCheckout()
    },
    mutationFn: (priceId: string) =>
      apiClient.post('/api/v1/stripe/checkout', { priceId }).then(r => r.data as { url: string }),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: unknown) => toast.error(errorDetail(err, CHECKOUT_ERROR_MESSAGE)),
  })
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () =>
      apiClient.post('/api/v1/stripe/portal').then(r => r.data as { url: string }),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: unknown) => toast.error(errorDetail(err, PORTAL_ERROR_MESSAGE)),
  })
}

// Redeem a comp promo code to get listed for free (no Stripe). Returns the updated subscription
// and refreshes the cached subscription so the UI flips to the comped/active state immediately.
export function useRedeemPromo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      apiClient.post('/api/v1/vendors/me/promo', { code }).then(r => r.data as SubscriptionInfo),
    onSuccess: (data) => {
      queryClient.setQueryData(['vendor', 'subscription'], data)
      queryClient.invalidateQueries({ queryKey: ['vendor', 'subscription'] })
    },
  })
}
