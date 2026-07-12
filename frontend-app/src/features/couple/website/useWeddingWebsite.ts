import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'

export interface WeddingWebsite {
  id: string
  coupleId: string
  slug: string
  isPublished: boolean
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  engagementDate: string | null
  heroPhotoUrl: string | null
  heroTagline: string | null
  ourStory: string | null
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
  partnerOneVows: string | null
  partnerTwoVows: string | null
  goalBudget: number | null
  // V34: per-couple tab visibility + custom labels. Both opaque strings the
  // backend never inspects: frontend parses on read, serializes on write.
  //   hiddenTabs       = CSV of BlockTab enum names ("REGISTRY,TRAVEL")
  //   customTabLabels  = JSON map ({"TRAVEL":"Hotels & flights"})
  hiddenTabs: string | null
  customTabLabels: string | null
  heroFocalPointX: number | null
  heroFocalPointY: number | null
  heroTaglineColor: string | null
  scriptureTranslation: string | null
  venuePhotoUrl: string | null
  venueAdditionalInfo: string | null
  accentColor: string | null
  // V62: CSS color for the scripture banner background. null = default dark gradient.
  scriptureBackgroundColor: string | null
  // V65: custom save-the-date image. null = use the default text-only STD email template.
  stdImageUrl: string | null
  // V90: reception venue (venue* above is the ceremony venue) + optional card titles.
  receptionVenueName: string | null
  receptionVenueAddress: string | null
  receptionVenueCity: string | null
  receptionVenueState: string | null
  receptionTime: string | null
  receptionVenueAdditionalInfo: string | null
  ceremonyVenueTitle: string | null
  receptionVenueTitle: string | null
  // V91: allowlisted font key for the couple's names on the public hero. null = default serif.
  nameFont: string | null
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
      // Don't retry 404: website just hasn't been created yet
      const status = (err as { response?: { status?: number } })?.response?.status
      return status !== 404 && count < 2
    },
    // A website's existence does not change while the couple is filling out the
    // onboarding wizard. Refetching on window focus re-throws the 404, which
    // (because an errored query has no cached data) flips isLoading back to true,
    // unmounts the wizard, and resets it to step 1 when the couple tabs away and
    // back. Disabling focus refetch keeps the wizard mounted and its progress intact.
    refetchOnWindowFocus: false,
    staleTime: 30_000,
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
  const mutation = useMutation({
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

    // Server response wins: replace optimistic data with the real saved record.
    onSuccess: (data) => qc.setQueryData(['wedding-website', coupleId], data),

    // If the PATCH fails, roll back to what was in the cache before the mutation,
    // then surface the failure. Before issue #95 this rolled back silently: the
    // couple's typed change vanished from the preview with no message, despite the
    // footer promising "Edits save automatically." The Retry action re-runs the
    // same PATCH so a transient network blip doesn't quietly cost them their edit.
    onError: (_err, payload, context) => {
      if (context?.previous) {
        qc.setQueryData(['wedding-website', coupleId], context.previous)
      }
      toast.error('Save failed. Please try again.', {
        action: { label: 'Retry', onClick: () => mutation.mutate(payload) },
      })
    },
  })
  return mutation
}

export function usePublishWeddingWebsite(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (publish: boolean) =>
      apiClient.post(`/api/v1/wedding-websites/couple/${coupleId}/${publish ? 'publish' : 'unpublish'}`).then(r => r.data),
    onSuccess: (data) => qc.setQueryData(['wedding-website', coupleId], data),
  })
}
