import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import { errorDetail } from '@/lib/apiError'

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
    // Surface the backend reason so a rejected budget save is not silent (#222).
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })
}

// Recompute the summary's derived totals from a patched item list, mirroring
// BudgetItemService.getSummary on the backend: totalBudget sums estimates,
// totalActual sums non-null actuals, totalPaid sums non-null actuals on paid
// items, totalRemaining is actual minus paid.
function recomputeTotals(items: BudgetItem[]): Omit<BudgetSummary, 'items'> {
  const totalBudget = items.reduce((sum, i) => sum + i.estimatedCost, 0)
  const totalActual = items.reduce((sum, i) => sum + (i.actualCost ?? 0), 0)
  const totalPaid = items.reduce(
    (sum, i) => sum + (i.isPaid ? (i.actualCost ?? 0) : 0),
    0,
  )
  return { totalBudget, totalActual, totalPaid, totalRemaining: totalActual - totalPaid }
}

export function useUpdateBudgetItem(coupleId: string) {
  const qc = useQueryClient()
  const queryKey = ['budget', coupleId]
  return useMutation({
    mutationFn: ({ itemId, ...payload }: UpdateBudgetItemPayload & { itemId: string }) =>
      apiClient.patch(`/api/v1/budget/couple/${coupleId}/${itemId}`, payload).then(r => r.data),
    // Optimistic update (issue #300): the Paid toggle is the most-repeated tap
    // on this page, so flip the cached item immediately and recompute the
    // derived totals from the cache; a slow PATCH no longer means dead air.
    onMutate: async ({ itemId, ...payload }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<BudgetSummary>(queryKey)
      qc.setQueryData<BudgetSummary>(queryKey, old => {
        if (!old) return old
        const items = old.items.map(i => {
          if (i.id !== itemId) return i
          return {
            ...i,
            ...(payload.category !== undefined ? { category: payload.category } : {}),
            ...(payload.vendorName !== undefined ? { vendorName: payload.vendorName } : {}),
            ...(payload.estimatedCost !== undefined ? { estimatedCost: payload.estimatedCost } : {}),
            ...(payload.actualCost !== undefined ? { actualCost: payload.actualCost } : {}),
            ...(payload.isPaid !== undefined ? { isPaid: payload.isPaid } : {}),
            ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
          }
        })
        return { ...recomputeTotals(items), items }
      })
      return { previous }
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
      toast.error(errorDetail(err))
    },
    // Always reconcile with the server's authoritative totals, success or error.
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })
}

export function useDeleteBudgetItem(coupleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete(`/api/v1/budget/couple/${coupleId}/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget', coupleId] }),
    onError: (err: unknown) => toast.error(errorDetail(err)),
  })
}
