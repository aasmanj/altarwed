import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'

export type PartySide = 'BRIDE' | 'GROOM' | 'NEUTRAL'

export interface WeddingPartyMember {
  id: string
  weddingWebsiteId: string
  name: string
  role: string
  side: PartySide
  bio: string | null
  photoUrl: string | null
  sortOrder: number
  // Non-destructive avatar framing (backend V70). null = centered / no zoom.
  focalPointX: number | null
  focalPointY: number | null
  zoom: number | null
}

export interface CreateMemberPayload {
  name: string
  role: string
  side: PartySide
  bio?: string
  sortOrder?: number
}

export interface UpdateMemberPayload {
  name?: string
  role?: string
  side?: PartySide
  bio?: string
  sortOrder?: number
  focalPointX?: number
  focalPointY?: number
  zoom?: number
}

const key = (websiteId: string) => ['wedding-party', websiteId]

export function useWeddingParty(websiteId: string) {
  return useQuery<WeddingPartyMember[]>({
    queryKey: key(websiteId),
    queryFn: () => apiClient.get(`/api/v1/wedding-party/website/${websiteId}`).then(r => r.data),
    enabled: !!websiteId,
  })
}

export function useAddMember(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMemberPayload) =>
      apiClient.post(`/api/v1/wedding-party/website/${websiteId}`, payload).then(r => r.data),
    onSuccess: (member: WeddingPartyMember) =>
      qc.setQueryData<WeddingPartyMember[]>(key(websiteId), old => old ? [...old, member] : [member]),
    // No optimistic update, nothing to roll back; surface the backend reason (a
    // @Size validation 400 carries a ProblemDetail detail) so a failed add does
    // not vanish silently (issue #303).
    onError: (err: unknown) =>
      toast.error(errorDetail(err, 'Could not add that member. Please try again.')),
  })
}

export function useUpdateMember(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: UpdateMemberPayload }) =>
      apiClient.patch(`/api/v1/wedding-party/website/${websiteId}/${memberId}`, payload).then(r => r.data),
    onSuccess: (updated: WeddingPartyMember) =>
      qc.setQueryData<WeddingPartyMember[]>(key(websiteId), old =>
        old?.map(m => m.id === updated.id ? updated : m) ?? []
      ),
    onError: (err: unknown) =>
      toast.error(errorDetail(err, 'Could not save those changes. Please try again.')),
  })
}

export function useReorderParty(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiClient.patch(`/api/v1/wedding-party/website/${websiteId}/reorder`, { orderedIds }),
    // Optimistic so the reorder feels instant; reassign sortOrder by index and roll back
    // to the snapshot if the server rejects.
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key(websiteId) })
      const prev = qc.getQueryData<WeddingPartyMember[]>(key(websiteId))
      qc.setQueryData<WeddingPartyMember[]>(key(websiteId), old =>
        old ? orderedIds.map((id, i) => ({ ...old.find(m => m.id === id)!, sortOrder: i })) : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key(websiteId), ctx.prev)
      toast.error('Could not save the new wedding party order. Please try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key(websiteId) }),
  })
}

export function useUploadMemberPhoto(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, file }: { memberId: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      return apiClient
        .post(`/api/v1/uploads/wedding-party/${websiteId}/${memberId}/photo`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data as { photoUrl: string })
    },
    onSuccess: (data, { memberId }) =>
      // A new photo resets framing server-side (the old crop no longer applies), so
      // mirror that in the cache to keep the avatar preview correct without a refetch.
      qc.setQueryData<WeddingPartyMember[]>(key(websiteId), old =>
        old?.map(m => m.id === memberId
          ? { ...m, photoUrl: data.photoUrl, focalPointX: null, focalPointY: null, zoom: null }
          : m) ?? []
      ),
  })
}

export function useDeleteMember(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      apiClient.delete(`/api/v1/wedding-party/website/${websiteId}/${memberId}`),
    onSuccess: (_data, memberId) =>
      qc.setQueryData<WeddingPartyMember[]>(key(websiteId), old =>
        old?.filter(m => m.id !== memberId) ?? []
      ),
    onError: (err: unknown) =>
      toast.error(errorDetail(err, 'Could not remove that member. Please try again.')),
  })
}
