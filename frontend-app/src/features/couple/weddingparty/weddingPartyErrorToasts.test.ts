import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #303: the add/update/delete wedding-party mutations had no onError at
// all, so a backend rejection (400 ProblemDetail, 5xx, network blip) left the
// couple staring at a UI that silently did nothing. Each hook now surfaces the
// ProblemDetail `detail` via a sonner toast (errorDetail pattern from #261),
// with a friendly action-specific fallback when no detail is present.
//
// Harness mirrors mutationErrorToasts.test.ts: mock useQueryClient/useMutation
// so useMutation hands back the options object the hook built, giving us the
// genuine onError closure to exercise exactly as React Query would on failure.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
}))

type AnyMutationOptions = {
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
import { useAddMember, useUpdateMember, useDeleteMember } from './useWeddingParty'

function problemDetailError(detail: string) {
  return { response: { data: { detail } } }
}

function runMutationError(hook: () => unknown, err: unknown) {
  sharedClient = new QueryClient()
  const options = hook() as AnyMutationOptions
  options.onError?.(err, {}, undefined)
}

beforeEach(() => {
  toastError.mockClear()
})

describe('wedding party mutation error toasts (issue #303)', () => {
  it('useAddMember: toasts the backend reason on failure', () => {
    runMutationError(
      () => useAddMember('site-1'),
      problemDetailError('Name must be at most 200 characters'),
    )
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Name must be at most 200 characters')
  })

  it('useAddMember: falls back to an add-specific message with no ProblemDetail', () => {
    runMutationError(() => useAddMember('site-1'), new Error('network down'))
    expect(toastError).toHaveBeenCalledWith('Could not add that member. Please try again.')
  })

  it('useUpdateMember: toasts the backend reason on failure', () => {
    runMutationError(
      () => useUpdateMember('site-1'),
      problemDetailError('Member not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Member not found')
  })

  it('useUpdateMember: falls back to a save-specific message with no ProblemDetail', () => {
    runMutationError(() => useUpdateMember('site-1'), new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('Could not save those changes. Please try again.')
  })

  it('useDeleteMember: toasts the backend reason on failure', () => {
    runMutationError(
      () => useDeleteMember('site-1'),
      problemDetailError('Member not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Member not found')
  })

  it('useDeleteMember: falls back to a remove-specific message with no ProblemDetail', () => {
    runMutationError(() => useDeleteMember('site-1'), new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('Could not remove that member. Please try again.')
  })
})
