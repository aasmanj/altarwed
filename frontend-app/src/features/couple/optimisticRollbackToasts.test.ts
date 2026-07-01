import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #134: five optimistic mutations had rollback-only onError handlers that
// restored the pre-mutation cache but showed no toast, so a couple saw their
// change silently vanish. Each onError must now ALSO surface a sonner
// toast.error after the rollback. These tests drive each real onError handler
// through a forced rejection and assert both halves: the cache is rolled back
// AND toast.error fired.
//
// We do this without a DOM. React Query hooks here only call useQueryClient and
// useMutation, so we mock those two: useQueryClient returns a shared real
// QueryClient we seed, and useMutation just hands back the options object the
// hook built. That gives us the genuine onMutate/onError closures to exercise
// by hand, exactly as React Query would run them on a failed mutation.

// vi.hoisted: the vi.mock factory below is hoisted to the top of the module, so
// the spy it references must be created in a hoisted block too, not a plain const.
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
    // Return the options object itself so callers can reach onMutate/onError.
    useMutation: (options: AnyMutationOptions) => options,
  }
})

import { QueryClient } from '@tanstack/react-query'
import { useUpdateGuest, useAssignGuestTable } from './guests/useGuests'
import { useReorderParty } from './weddingparty/useWeddingParty'
import { useToggleTask } from './checklist/usePlanningTasks'
import { useReorderPhotos } from './photos/PhotosPage'

// Built from a char code so this file itself contains no literal em dash (house rule).
const EM_DASH = String.fromCharCode(0x2014)

// Run a hook's real onMutate then onError against a seeded cache, simulating a
// server rejection, and return the cache state after rollback.
async function runOptimisticFailure<T>(
  // At runtime our mocked useMutation returns the raw options object, but the
  // hooks are typed to return UseMutationResult, so accept unknown and narrow.
  hook: () => unknown,
  queryKey: unknown[],
  seed: T,
  vars: unknown,
) {
  sharedClient = new QueryClient()
  sharedClient.setQueryData(queryKey, seed)

  const options = hook() as AnyMutationOptions
  const ctx = await options.onMutate?.(vars)
  options.onError?.(new Error('boom'), vars, ctx)

  return sharedClient.getQueryData<T>(queryKey)
}

// Assert the single toast this run produced is user-facing and em-dash free.
function expectCleanToast() {
  expect(toastError).toHaveBeenCalledTimes(1)
  const msg = String(toastError.mock.calls[0][0])
  expect(msg.length).toBeGreaterThan(0)
  expect(msg).not.toContain(EM_DASH)
}

beforeEach(() => {
  toastError.mockClear()
})

describe('optimistic mutation rollback toasts (issue #134)', () => {
  it('useUpdateGuest: rolls back and toasts on failure', async () => {
    const seed = [{ id: 'g1', name: 'Ada', tableNumber: 1 }]
    const after = await runOptimisticFailure(
      () => useUpdateGuest('couple-1'),
      ['guests', 'couple-1'],
      seed,
      { guestId: 'g1', payload: { name: 'Grace' } },
    )
    expect(after).toEqual(seed)
    expectCleanToast()
  })

  it('useAssignGuestTable: rolls back and toasts on failure', async () => {
    const seed = [{ id: 'g1', name: 'Ada', tableNumber: 1 }]
    const after = await runOptimisticFailure(
      () => useAssignGuestTable('couple-1'),
      ['guests', 'couple-1'],
      seed,
      { guestId: 'g1', tableNumber: 5 },
    )
    expect(after).toEqual(seed)
    expectCleanToast()
  })

  it('useReorderParty: rolls back and toasts on failure', async () => {
    const seed = [
      { id: 'm1', name: 'A', sortOrder: 0 },
      { id: 'm2', name: 'B', sortOrder: 1 },
    ]
    const after = await runOptimisticFailure(
      () => useReorderParty('site-1'),
      ['wedding-party', 'site-1'],
      seed,
      ['m2', 'm1'],
    )
    expect(after).toEqual(seed)
    expectCleanToast()
  })

  it('useToggleTask: rolls back and toasts on failure', async () => {
    const seed = [{ id: 't1', title: 'Book venue', isCompleted: false }]
    const after = await runOptimisticFailure(
      () => useToggleTask('couple-1'),
      ['planning-tasks', 'couple-1'],
      seed,
      { taskId: 't1', isCompleted: true },
    )
    expect(after).toEqual(seed)
    expectCleanToast()
  })

  it('useReorderPhotos: rolls back and toasts on failure', async () => {
    const seed = [
      { id: 'p1', url: 'a', sortOrder: 0 },
      { id: 'p2', url: 'b', sortOrder: 1 },
    ]
    const after = await runOptimisticFailure(
      () => useReorderPhotos('site-1'),
      ['wedding-photos', 'site-1'],
      seed,
      ['p2', 'p1'],
    )
    expect(after).toEqual(seed)
    expectCleanToast()
  })
})
