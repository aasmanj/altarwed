import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface Inquiry {
  id: string
  coupleName: string
  coupleEmail: string
  weddingDate: string | null
  message: string
  isRead: boolean
  createdAt: string
}

const INQUIRIES_KEY = ['vendor', 'inquiries']

export function useVendorInquiries() {
  return useQuery<Inquiry[]>({
    queryKey: INQUIRIES_KEY,
    queryFn: () => apiClient.get('/api/v1/vendors/me/inquiries').then(r => r.data),
  })
}

export function useMarkInquiryRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/api/v1/vendors/me/inquiries/${id}/read`),
    onSuccess: (_, id) => {
      qc.setQueryData<Inquiry[]>(INQUIRIES_KEY, prev =>
        prev ? prev.map(i => i.id === id ? { ...i, isRead: true } : i) : prev
      )
    },
  })
}
