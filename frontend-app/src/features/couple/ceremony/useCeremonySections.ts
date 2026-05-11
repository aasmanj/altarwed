import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface CeremonySection {
  id: string
  coupleId: string
  title: string
  sectionType: string
  content: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CeremonySectionPayload {
  title: string
  sectionType: string
  content?: string
  sortOrder: number
}

export function useCeremonySections(coupleId: string) {
  return useQuery<CeremonySection[]>({
    queryKey: ['ceremony-sections', coupleId],
    queryFn: () => apiClient.get(`/api/v1/ceremony-sections/couple/${coupleId}`).then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useCreateCeremonySection(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CeremonySectionPayload) =>
      apiClient.post(`/api/v1/ceremony-sections/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony-sections', coupleId] }),
  })
}

export function useUpdateCeremonySection(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CeremonySectionPayload }) =>
      apiClient.put(`/api/v1/ceremony-sections/${id}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony-sections', coupleId] }),
  })
}

export function useDeleteCeremonySection(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/ceremony-sections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony-sections', coupleId] }),
  })
}
