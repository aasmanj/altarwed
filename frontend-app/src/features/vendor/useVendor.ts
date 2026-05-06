import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface VendorProfile {
  id: string
  businessName: string
  category: string
  city: string
  state: string
  email: string
  isChristianOwned: boolean
  denominationIds: string[]
  isVerified: boolean
}

export interface UpdateVendorPayload {
  businessName?: string
  category?: string
  city?: string
  state?: string
  isChristianOwned?: boolean
}

const ME_KEY = ['vendor', 'me']

export function useVendorProfile() {
  return useQuery<VendorProfile>({
    queryKey: ME_KEY,
    queryFn: () => apiClient.get('/api/v1/vendors/me').then(r => r.data),
  })
}

export function useUpdateVendorProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateVendorPayload) =>
      apiClient.patch('/api/v1/vendors/me', payload).then(r => r.data),
    onSuccess: (updated: VendorProfile) => qc.setQueryData(ME_KEY, updated),
  })
}
