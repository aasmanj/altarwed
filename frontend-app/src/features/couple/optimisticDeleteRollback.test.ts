import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #302 (item 2): the couple-side delete mutations (guest row, album photo,
// checklist task) were fire-and-forget with no onError, so a rejected delete
// silently left the row on screen after the couple believed it was gone (or,
// with a cache filter in onSuccess only, left it until the next refetch with no
// explanation). Each delete is now optimistic with a snapshot rollback, matching
// useReorderPhotos: the row disappears instantly, and a server rejection puts it
// back AND explains why via toast.error.
//
// Harness mirrors optimisticRollbackToasts.test.ts: mock useQueryClient to a
// shared real QueryClient we seed, and mock useMutation to hand back the options
// object, so we can drive the genuine onMutate/onError closures exactly as React
// Query would on a failed mutation. No DOM needed.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn(), promise: vi.fn() },
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
import { useRemoveGuest } from './guests/useGuests'
import { useDeleteTask } from './checklist/usePlanningTasks'
import { useDeletePhoto } from './photos/PhotosPage'

// A Spring ProblemDetail rejection, shaped like the axios error the hooks read.
function problemDetailError(detail: string) {
  return { response: { data: { detail } } }
}

// Drive one optimistic delete through onMutate (assert the optimistic removal)
// then onError (assert the rollback), returning the final cache state.
async function runDelete<T extends { id: string }>(
  hook: () => unknown,
  queryKey: unknown[],
  seed: T[],
  deletedId: string,
  err: unknown,
) {
  sharedClient = new QueryClient()
  sharedClient.setQueryData(queryKey, seed)

  const options = hook() as AnyMutationOptions
  const ctx = await options.onMutate?.(deletedId)

  // Optimistic half: the row must be gone immediately, before the server answers.
  const during = sharedClient.getQueryData<T[]>(queryKey)
  expect(during?.some(row => row.id === deletedId)).toBe(false)

  options.onError?.(err, deletedId, ctx)
  return sharedClient.getQueryData<T[]>(queryKey)
}

beforeEach(() => {
  toastError.mockClear()
})

describe('optimistic delete rollback (issue #302)', () => {
  it('useRemoveGuest: removes optimistically, rolls back and toasts the reason on failure', async () => {
    const seed = [
      { id: 'g1', name: 'Ada', rsvpStatus: 'PENDING' },
      { id: 'g2', name: 'Grace', rsvpStatus: 'ATTENDING' },
    ]
    const after = await runDelete(
      () => useRemoveGuest('couple-1'),
      ['guests', 'couple-1'],
      seed,
      'g1',
      problemDetailError('Guest not found'),
    )
    expect(after).toEqual(seed)
    expect(toastError).toHaveBeenCalledWith('Guest not found')
  })

  it('useDeletePhoto: removes optimistically, rolls back with a friendly fallback on failure', async () => {
    const seed = [
      { id: 'p1', url: 'a', sortOrder: 0 },
      { id: 'p2', url: 'b', sortOrder: 1 },
    ]
    const after = await runDelete(
      () => useDeletePhoto('site-1'),
      ['wedding-photos', 'site-1'],
      seed,
      'p2',
      new Error('Network Error'),
    )
    expect(after).toEqual(seed)
    expect(toastError).toHaveBeenCalledWith('Could not remove the photo. Please try again.')
  })

  it('useDeleteTask: removes optimistically, rolls back and toasts on failure', async () => {
    const seed = [
      { id: 't1', title: 'Book venue', isCompleted: false },
      { id: 't2', title: 'Choose scripture', isCompleted: true },
    ]
    const after = await runDelete(
      () => useDeleteTask('couple-1'),
      ['planning-tasks', 'couple-1'],
      seed,
      't1',
      new Error('boom'),
    )
    expect(after).toEqual(seed)
    expect(toastError).toHaveBeenCalledTimes(1)
  })
})
