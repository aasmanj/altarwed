import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

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
    mutationFn: (priceId: string) =>
      apiClient.post('/api/v1/stripe/checkout', { priceId }).then(r => r.data as { url: string }),
    onSuccess: ({ url }) => { window.location.href = url },
  })
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () =>
      apiClient.post('/api/v1/stripe/portal').then(r => r.data as { url: string }),
    onSuccess: ({ url }) => { window.location.href = url },
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
