import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

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
      qc.setQueryData<WeddingPartyMember[]>(key(websiteId), old =>
        old?.map(m => m.id === memberId ? { ...m, photoUrl: data.photoUrl } : m) ?? []
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
  })
}
