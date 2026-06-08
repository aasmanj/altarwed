import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface SubscriptionInfo {
  planTier: 'BASIC' | 'FEATURED' | 'PREMIUM'
  status: 'NONE' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING'
  currentPeriodEnd: string | null
  proMonthlyPriceId: string | null
  proAnnualPriceId: string | null
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
