import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/core/api/client'
import type { BlockTab, BlockType, WeddingPageBlock } from './types'

const blocksKey = (websiteId: string) => ['wedding-page-blocks', websiteId] as const

export function useWeddingPageBlocks(websiteId: string | undefined) {
  return useQuery<WeddingPageBlock[]>({
    queryKey: blocksKey(websiteId ?? 'none'),
    enabled: !!websiteId,
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/wedding-page-blocks/website/${websiteId}`)
      return res.data
    },
  })
}

interface CreatePayload {
  tab: BlockTab
  type: BlockType
  contentJson: string
}

export function useCreateBlock(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePayload) =>
      apiClient
        .post(`/api/v1/wedding-page-blocks/website/${websiteId}`, payload)
        .then(r => r.data as WeddingPageBlock),
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(websiteId) }),
    // Before issue #105 a failed create was fully silent: the picker closed, no
    // block appeared, no error. The couple thought "Add block" was broken.
    onError: () => toast.error('Failed to add block. Please try again.'),
  })
}

export function useUpdateBlock(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ blockId, contentJson }: { blockId: string; contentJson: string }) =>
      apiClient
        .patch(`/api/v1/wedding-page-blocks/website/${websiteId}/${blockId}`, { contentJson })
        .then(r => r.data as WeddingPageBlock),

    // Optimistic: write contentJson into the cached list immediately so the form
    // and the preview iframe both see the new value before the server responds.
    onMutate: async ({ blockId, contentJson }) => {
      await qc.cancelQueries({ queryKey: blocksKey(websiteId) })
      const previous = qc.getQueryData<WeddingPageBlock[]>(blocksKey(websiteId))
      if (previous) {
        qc.setQueryData<WeddingPageBlock[]>(
          blocksKey(websiteId),
          previous.map(b => (b.id === blockId ? { ...b, contentJson } : b)),
        )
      }
      return { previous }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.previous) qc.setQueryData(blocksKey(websiteId), ctx.previous)
      // Surface the failure instead of silently reverting the optimistic edit (#95).
      toast.error('Block save failed. Please try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: blocksKey(websiteId) }),
  })
}

export function useDeleteBlock(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (blockId: string) =>
      apiClient.delete(`/api/v1/wedding-page-blocks/website/${websiteId}/${blockId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(websiteId) }),
    onError: () => toast.error('Failed to remove block. Please try again.'),
  })
}

export function useReorderBlocks(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tab, orderedBlockIds }: { tab: BlockTab; orderedBlockIds: string[] }) =>
      apiClient
        .patch(
          `/api/v1/wedding-page-blocks/website/${websiteId}/tab/${tab}/reorder`,
          { orderedBlockIds },
        )
        .then(r => r.data as WeddingPageBlock[]),

    // Optimistic reorder so the drag feels instant; rollback on failure.
    onMutate: async ({ tab, orderedBlockIds }) => {
      await qc.cancelQueries({ queryKey: blocksKey(websiteId) })
      const previous = qc.getQueryData<WeddingPageBlock[]>(blocksKey(websiteId))
      if (previous) {
        const indexById = new Map(orderedBlockIds.map((id, i) => [id, (i + 1) * 10]))
        qc.setQueryData<WeddingPageBlock[]>(
          blocksKey(websiteId),
          previous.map(b =>
            b.tab === tab && indexById.has(b.id)
              ? { ...b, sortOrder: indexById.get(b.id)! }
              : b,
          ),
        )
      }
      return { previous }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.previous) qc.setQueryData(blocksKey(websiteId), ctx.previous)
      // Surface the failure instead of silently reverting the optimistic reorder (#95).
      toast.error('Could not save the new order. Please try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: blocksKey(websiteId) }),
  })
}

export function useBackfillBlocks(websiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient
        .post(`/api/v1/wedding-page-blocks/website/${websiteId}/backfill`)
        .then(r => r.data as { websiteId: string; blocksCreated: number; tabsSkipped: string[] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(websiteId) }),
  })
}
