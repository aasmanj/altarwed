import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'

export type BudgetCategory =
  | 'VENUE' | 'CATERING' | 'PHOTOGRAPHY' | 'VIDEOGRAPHY' | 'FLOWERS'
  | 'MUSIC' | 'ATTIRE' | 'CAKE' | 'INVITATIONS' | 'HAIR_AND_MAKEUP'
  | 'TRANSPORTATION' | 'OFFICIANT' | 'HONEYMOON' | 'RINGS'
  | 'DECORATIONS' | 'TITHE_AND_GIVING' | 'OTHER'

export const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  VENUE: 'Venue',
  CATERING: 'Catering',
  PHOTOGRAPHY: 'Photography',
  VIDEOGRAPHY: 'Videography',
  FLOWERS: 'Flowers',
  MUSIC: 'Music',
  ATTIRE: 'Attire',
  CAKE: 'Cake',
  INVITATIONS: 'Invitations',
  HAIR_AND_MAKEUP: 'Hair & Makeup',
  TRANSPORTATION: 'Transportation',
  OFFICIANT: 'Officiant',
  HONEYMOON: 'Honeymoon',
  RINGS: 'Rings',
  DECORATIONS: 'Decorations',
  TITHE_AND_GIVING: 'Tithe & Giving',
  OTHER: 'Other',
}

export interface BudgetItem {
  id: string
  coupleId: string
  category: BudgetCategory
  vendorName: string
  estimatedCost: number
  actualCost: number | null
  isPaid: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface BudgetSummary {
  totalBudget: number
  totalActual: number
  totalPaid: number
  totalRemaining: number
  items: BudgetItem[]
}

export interface CreateBudgetItemPayload {
  category: BudgetCategory
  vendorName: string
  estimatedCost: number
  actualCost?: number
  isPaid: boolean
  notes?: string
}

export interface UpdateBudgetItemPayload {
  category?: BudgetCategory
  vendorName?: string
  estimatedCost?: number
  actualCost?: number | null
  isPaid?: boolean
  notes?: string | null
}

export function useBudget(coupleId: string) {
  return useQuery<BudgetSummary>({
    queryKey: ['budget', coupleId],
    queryFn: () => apiClient.get(`/api/v1/budget/couple/${coupleId}`).then(r => r.data),
    enabled: !!coupleId,
  })
}

export function useCreateBudgetItem(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBudgetItemPayload) =>
      apiClient.post(`/api/v1/budget/couple/${coupleId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget', coupleId] }),
  })
}

export function useUpdateBudgetItem(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...payload }: UpdateBudgetItemPayload & { itemId: string }) =>
      apiClient.patch(`/api/v1/budget/couple/${coupleId}/${itemId}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget', coupleId] }),
  })
}

export function useDeleteBudgetItem(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete(`/api/v1/budget/couple/${coupleId}/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget', coupleId] }),
  })
}
