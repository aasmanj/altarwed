import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface WeddingWebsite {
  id: string
  coupleId: string
  slug: string
  isPublished: boolean
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  heroPhotoUrl: string | null
  ourStory: string | null
  testimony: string | null
  covenantStatement: string | null
  scriptureReference: string | null
  scriptureText: string | null
  venueName: string | null
  venueAddress: string | null
  venueCity: string | null
  venueState: string | null
  ceremonyTime: string | null
  dressCode: string | null
  hotelName: string | null
  hotelUrl: string | null
  hotelDetails: string | null
  registryUrl1: string | null
  registryLabel1: string | null
  registryUrl2: string | null
  registryLabel2: string | null
  registryUrl3: string | null
  registryLabel3: string | null
  rsvpDeadline: string | null
  isPinProtected: boolean
  partnerOneVows: string | null
  partnerTwoVows: string | null
}

export interface CreateWebsitePayload {
  slug: string
  partnerOneName: string
  partnerTwoName: string
  weddingDate?: string
}

export type UpdateWebsitePayload = Partial<Omit<WeddingWebsite, 'id' | 'coupleId' | 'slug' | 'isPublished' | 'createdAt' | 'updatedAt'>>

export function useWeddingWebsite(coupleId: string) {
  return useQuery<WeddingWebsite>({
    queryKey: ['wedding-website', coupleId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/wedding-websites/couple/${coupleId}`)
      return res.data
    },
    retry: (count, err: unknown) => {
      // Don't retry 404 — website just hasn't been created yet
      const status = (err as { response?: { status?: number } })?.response?.status
      return status !== 404 && count < 2
    },
  })
}

export function useCreateWeddingWebsite(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateWebsitePayload) =>
      apiClient.post(`/api/v1/wedding-websites/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: (data) => qc.setQueryData(['wedding-website', coupleId], data),
  })
}

export function useUpdateWeddingWebsite(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateWebsitePayload) =>
      apiClient.patch(`/api/v1/wedding-websites/couple/${coupleId}`, payload).then(r => r.data),

    // Optimistic update: write new values to the cache instantly so the UI
    // reflects the change before the server responds.
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['wedding-website', coupleId] })
      const previous = qc.getQueryData<WeddingWebsite>(['wedding-website', coupleId])
      qc.setQueryData(['wedding-website', coupleId], (old: WeddingWebsite | undefined) =>
        old ? { ...old, ...payload } : old
      )
      return { previous }
    },

    // Server response wins — replace optimistic data with the real saved record.
    onSuccess: (data) => qc.setQueryData(['wedding-website', coupleId], data),

    // If the PATCH fails, roll back to what was in the cache before the mutation.
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        qc.setQueryData(['wedding-website', coupleId], context.previous)
      }
    },
  })
}

export function usePublishWeddingWebsite(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (publish: boolean) =>
      apiClient.post(`/api/v1/wedding-websites/couple/${coupleId}/${publish ? 'publish' : 'unpublish'}`).then(r => r.data),
    onSuccess: (data) => qc.setQueryData(['wedding-website', coupleId], data),
  })
}
