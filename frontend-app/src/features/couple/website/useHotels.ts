import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface WeddingHotel {
  id: string
  websiteId: string
  name: string
  address: string | null
  bookingUrl: string | null
  blockRate: string | null
  distanceFromVenue: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface WeddingHotelPayload {
  name: string
  address?: string
  bookingUrl?: string
  blockRate?: string
  distanceFromVenue?: string
  sortOrder?: number
}

const key = (websiteId: string) => ['hotels', websiteId]

export function useHotels(websiteId: string) {
  return useQuery<WeddingHotel[]>({
    queryKey: key(websiteId),
    queryFn: () => apiClient.get(`/api/v1/wedding-websites/${websiteId}/hotels`).then(r => r.data),
    enabled: !!websiteId,
  })
}

export function useAddHotel(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: WeddingHotelPayload) =>
      apiClient.post(`/api/v1/wedding-websites/${websiteId}/hotels`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(websiteId) }),
  })
}

export function useUpdateHotel(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ hotelId, payload }: { hotelId: string; payload: WeddingHotelPayload }) =>
      apiClient.patch(`/api/v1/wedding-websites/${websiteId}/hotels/${hotelId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(websiteId) }),
  })
}

export function useDeleteHotel(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hotelId: string) =>
      apiClient.delete(`/api/v1/wedding-websites/${websiteId}/hotels/${hotelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(websiteId) }),
  })
}
