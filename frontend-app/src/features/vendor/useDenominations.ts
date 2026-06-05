import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export interface Denomination {
  id: string
  name: string
  slug: string
}

export function useDenominations() {
  return useQuery<Denomination[]>({
    queryKey: ['denominations'],
    queryFn: () => apiClient.get('/api/v1/denominations').then(r => r.data),
    staleTime: Infinity,
  })
}
