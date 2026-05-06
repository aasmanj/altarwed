import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface SeatingTable {
  id: string
  coupleId: string
  name: string
  capacity: number
  sortOrder: number
}

const key = (coupleId: string) => ['seating-tables', coupleId]

export function useSeatingTables(coupleId: string) {
  return useQuery<SeatingTable[]>({
    queryKey: key(coupleId),
    queryFn: () => apiClient.get(`/api/v1/seating-tables/couple/${coupleId}`).then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useCreateSeatingTable(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; capacity: number }) =>
      apiClient.post(`/api/v1/seating-tables/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(coupleId) }),
  })
}

export function useUpdateSeatingTable(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tableId, ...payload }: { tableId: string; name?: string; capacity?: number }) =>
      apiClient.patch(`/api/v1/seating-tables/couple/${coupleId}/${tableId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(coupleId) }),
  })
}

export function useDeleteSeatingTable(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tableId: string) =>
      apiClient.delete(`/api/v1/seating-tables/couple/${coupleId}/${tableId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(coupleId) }),
  })
}
