import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

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
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
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
  })
}
