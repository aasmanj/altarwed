import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface VendorProfile {
  id: string
  email: string
  businessName: string
  category: string
  city: string
  state: string
  isChristianOwned: boolean
  denominationIds: string[]
  isVerified: boolean
  // Listing visibility toggle. false = paused (hidden from the directory, no new inquiries).
  isActive: boolean
  priceTier: string | null
  bio: string | null
  description: string | null
  websiteUrl: string | null
  phone: string | null
  logoUrl: string | null
  contactEmail: string | null
}

export interface UpdateVendorPayload {
  businessName?: string
  category?: string
  city?: string
  state?: string
  isChristianOwned?: boolean
  denominationIds?: string[]
  priceTier?: string
  bio?: string
  description?: string
  websiteUrl?: string
  phone?: string
  contactEmail?: string
}

const ME_KEY = ['vendor', 'me']

export interface VendorStats {
  viewCount: number
  inquiryCount: number
  unreadInquiryCount: number
}

export function useVendorStats() {
  return useQuery<VendorStats>({
    queryKey: ['vendor', 'stats'],
    queryFn: () => apiClient.get('/api/v1/vendors/me/stats').then(r => r.data),
  })
}

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

// Pause (active=false) or resume (active=true) the vendor's own public listing.
export function useSetListingActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (active: boolean) =>
      apiClient.patch('/api/v1/vendors/me/listing', { active }).then(r => r.data as VendorProfile),
    onSuccess: updated => qc.setQueryData(ME_KEY, updated),
  })
}

export function useUploadVendorLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post('/api/v1/vendors/me/logo', fd).then(r => r.data as { logoUrl: string })
    },
    onSuccess: ({ logoUrl }) => {
      qc.setQueryData<VendorProfile>(ME_KEY, prev =>
        prev ? { ...prev, logoUrl } : prev
      )
    },
  })
}
