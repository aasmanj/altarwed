import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #303: vendor portfolio reorder and caption edits were silent no-ops on
// failure; the reorder arrow looked broken and a rejected caption just vanished.
// The reorder mutation is now optimistic (instant move) with a rollback + toast
// on failure, and the caption mutation surfaces the ProblemDetail reason.
//
// Harness mirrors optimisticRollbackToasts.test.ts: mock useQueryClient with a
// shared real QueryClient we seed, and mock useMutation to hand back the options
// object so we can drive the genuine onMutate/onError closures by hand exactly
// as React Query would on a failed mutation.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
}))

type AnyMutationOptions = {
  onMutate?: (vars: unknown) => Promise<unknown> | unknown
  onError?: (err: unknown, vars: unknown, ctx: unknown) => void
}

let sharedClient: import('@tanstack/react-query').QueryClient

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => sharedClient,
    useMutation: (options: AnyMutationOptions) => options,
  }
})

import { QueryClient } from '@tanstack/react-query'
import {
  useReorderPortfolioPhotos,
  useUpdatePortfolioPhotoCaption,
  type PortfolioPhoto,
} from './useVendorPortfolio'

const PORTFOLIO_KEY = ['vendor', 'portfolio-photos']

function photo(id: string, sortOrder: number): PortfolioPhoto {
  return { id, photoUrl: `https://cdn/${id}.jpg`, caption: null, sortOrder, createdAt: '2026-07-01T00:00:00Z' }
}

beforeEach(() => {
  toastError.mockClear()
  sharedClient = new QueryClient()
})

describe('vendor portfolio reorder (issue #303)', () => {
  it('optimistically applies the new order on mutate', async () => {
    const seed = [photo('p1', 0), photo('p2', 1)]
    sharedClient.setQueryData(PORTFOLIO_KEY, seed)

    const options = useReorderPortfolioPhotos() as unknown as AnyMutationOptions
    await options.onMutate?.(['p2', 'p1'])

    const after = sharedClient.getQueryData<PortfolioPhoto[]>(PORTFOLIO_KEY)
    expect(after?.map(p => p.id)).toEqual(['p2', 'p1'])
    expect(after?.map(p => p.sortOrder)).toEqual([0, 1])
  })

  it('rolls back to the snapshot and toasts when the server rejects', async () => {
    const seed = [photo('p1', 0), photo('p2', 1)]
    sharedClient.setQueryData(PORTFOLIO_KEY, seed)

    const options = useReorderPortfolioPhotos() as unknown as AnyMutationOptions
    const ctx = await options.onMutate?.(['p2', 'p1'])
    options.onError?.(new Error('boom'), ['p2', 'p1'], ctx)

    expect(sharedClient.getQueryData<PortfolioPhoto[]>(PORTFOLIO_KEY)).toEqual(seed)
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Could not save the new photo order. Please try again.')
  })
})

describe('vendor portfolio caption (issue #303)', () => {
  it('toasts the backend reason on failure', () => {
    const options = useUpdatePortfolioPhotoCaption() as unknown as AnyMutationOptions
    options.onError?.(
      { response: { data: { detail: 'Caption must be at most 200 characters' } } },
      { photoId: 'p1', caption: 'x' },
      undefined,
    )
    expect(toastError).toHaveBeenCalledWith('Caption must be at most 200 characters')
  })

  it('falls back to a caption-specific message with no ProblemDetail', () => {
    const options = useUpdatePortfolioPhotoCaption() as unknown as AnyMutationOptions
    options.onError?.(new Error('network down'), { photoId: 'p1', caption: 'x' }, undefined)
    expect(toastError).toHaveBeenCalledWith('Could not save the caption. Please try again.')
  })
})
