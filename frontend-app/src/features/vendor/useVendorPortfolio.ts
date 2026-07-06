import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'

export interface PortfolioPhoto {
  id: string
  photoUrl: string
  caption: string | null
  sortOrder: number
  createdAt: string
}

const PORTFOLIO_KEY = ['vendor', 'portfolio-photos']

export function usePortfolioPhotos(vendorId: string | undefined) {
  return useQuery<PortfolioPhoto[]>({
    queryKey: PORTFOLIO_KEY,
    queryFn: () => apiClient.get(`/api/v1/vendors/${vendorId}/portfolio-photos`).then(r => r.data),
    enabled: !!vendorId,
  })
}

export function useUploadPortfolioPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      if (caption) fd.append('caption', caption)
      return apiClient.post('/api/v1/vendors/me/portfolio-photos', fd).then(r => r.data as PortfolioPhoto)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  })
}

export function useDeletePortfolioPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (photoId: string) =>
      apiClient.delete(`/api/v1/vendors/me/portfolio-photos/${photoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  })
}

export function useReorderPortfolioPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiClient.patch('/api/v1/vendors/me/portfolio-photos/reorder', { orderedIds }),
    // Optimistic so the arrow click feels instant (same pattern as useReorderParty):
    // reassign sortOrder by index, roll back to the snapshot and toast if the
    // server rejects, and settle-refetch to reconcile (issue #303).
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: PORTFOLIO_KEY })
      const prev = qc.getQueryData<PortfolioPhoto[]>(PORTFOLIO_KEY)
      qc.setQueryData<PortfolioPhoto[]>(PORTFOLIO_KEY, old =>
        old ? orderedIds.map((id, i) => ({ ...old.find(p => p.id === id)!, sortOrder: i })) : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(PORTFOLIO_KEY, ctx.prev)
      toast.error('Could not save the new photo order. Please try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  })
}

export function useUpdatePortfolioPhotoCaption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string }) =>
      apiClient.patch(`/api/v1/vendors/me/portfolio-photos/${photoId}/caption`, null, {
        params: { caption },
      }).then(r => r.data as PortfolioPhoto),
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
    // Caption saves fire on blur with no pending UI, so a rejection was a silent
    // no-op; surface the backend reason (or a friendly fallback) (issue #303).
    onError: (err: unknown) =>
      toast.error(errorDetail(err, 'Could not save the caption. Please try again.')),
  })
}
