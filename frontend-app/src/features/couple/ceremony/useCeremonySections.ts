import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'
import { computeCeremonyReorderWrites, reorderSections } from './ceremonyReorder'

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
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })
}

export function useUpdateCeremonySection(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CeremonySectionPayload }) =>
      apiClient.put(`/api/v1/ceremony-sections/${id}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony-sections', coupleId] }),
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })
}

// Persist a drag-to-reorder. The list has no bulk-reorder endpoint, so this reuses the
// per-section update endpoint: it PUTs sortOrder = new array index for each section that
// actually moved. Optimistic (drag should feel instant) with snapshot rollback, matching
// useReorderPhotos. The pre-drag snapshot is passed in from the component so the write set
// is computed from the old positions, not the already-optimistically-updated cache.
export function useReorderCeremonySections(coupleId: string) {
  const qc = useQueryClient()
  const key = ['ceremony-sections', coupleId]
  return useMutation({
    mutationFn: ({ snapshot, orderedIds }: { snapshot: CeremonySection[]; orderedIds: string[] }) => {
      const writes = computeCeremonyReorderWrites(snapshot, orderedIds)
      return Promise.all(
        writes.map(w => apiClient.put(`/api/v1/ceremony-sections/${w.id}`, w.payload)),
      )
    },
    onMutate: async ({ orderedIds }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<CeremonySection[]>(key)
      qc.setQueryData<CeremonySection[]>(key, old => (old ? reorderSections(old, orderedIds) : old))
      return { prev }
    },
    onError: (_err: unknown, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error('Could not save the new order. Please try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteCeremonySection(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/ceremony-sections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony-sections', coupleId] }),
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })
}
