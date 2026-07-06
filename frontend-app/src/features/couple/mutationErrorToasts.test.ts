import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #222: several core couple mutations had no onError handler, so when the
// backend rejected (a 400 ProblemDetail from @Size validation, a 5xx, a network
// blip) the button flipped back and the couple saw nothing at all. Each listed
// mutation now has an onError that surfaces the backend `detail` via a sonner
// toast, with a generic fallback when no ProblemDetail is present.
//
// These tests drive each real onError handler through a forced rejection and
// assert the toast fired with the right message. They mirror the harness in
// optimisticRollbackToasts.test.ts: we mock useQueryClient and useMutation so
// useMutation hands back the options object the hook built, giving us the genuine
// onError closure to exercise by hand exactly as React Query would on failure.

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
import { useAddGuest } from './guests/useGuests'
import { useCreateBudgetItem, useUpdateBudgetItem, useDeleteBudgetItem } from './budget/useBudget'
import {
  useCreateCeremonySection,
  useUpdateCeremonySection,
  useDeleteCeremonySection,
} from './ceremony/useCeremonySections'
import {
  useCreateSeatingTable,
  useUpdateSeatingTable,
  useDeleteSeatingTable,
} from './seating/useSeatingTables'
import { useAddHotel, useUpdateHotel, useDeleteHotel } from './website/useHotels'
import { errorDetail, DEFAULT_ERROR_MESSAGE } from '../../lib/apiError'

// A Spring ProblemDetail rejection, shaped like the axios error the hooks read.
function problemDetailError(detail: string) {
  return { response: { data: { detail } } }
}

// Run a hook's real onError against a forced rejection and return nothing; the
// assertion is on the mocked toast.error the handler fired.
function runMutationError(hook: () => unknown, err: unknown, vars: unknown = {}) {
  sharedClient = new QueryClient()
  const options = hook() as AnyMutationOptions
  options.onError?.(err, vars, undefined)
}

beforeEach(() => {
  toastError.mockClear()
})

describe('errorDetail (issue #222)', () => {
  it('returns the ProblemDetail detail when present', () => {
    expect(errorDetail(problemDetailError('Name must be at most 200 characters')))
      .toBe('Name must be at most 200 characters')
  })

  it('falls back to the default when no detail is present', () => {
    expect(errorDetail(new Error('network down'))).toBe(DEFAULT_ERROR_MESSAGE)
    expect(errorDetail({ response: { data: {} } })).toBe(DEFAULT_ERROR_MESSAGE)
    expect(errorDetail({ response: { data: { detail: '   ' } } })).toBe(DEFAULT_ERROR_MESSAGE)
  })

  it('honours a caller-supplied fallback', () => {
    expect(errorDetail(new Error('boom'), 'Unknown error')).toBe('Unknown error')
  })
})

describe('core mutation error toasts (issue #222)', () => {
  it('useAddGuest: toasts the backend reason on failure', () => {
    runMutationError(
      () => useAddGuest('couple-1'),
      problemDetailError('Name must be at most 200 characters'),
    )
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Name must be at most 200 characters')
  })

  it('useAddGuest: falls back to the generic message with no ProblemDetail', () => {
    runMutationError(() => useAddGuest('couple-1'), new Error('boom'))
    expect(toastError).toHaveBeenCalledWith(DEFAULT_ERROR_MESSAGE)
  })

  it('useCreateBudgetItem: toasts the backend reason on failure', () => {
    runMutationError(
      () => useCreateBudgetItem('couple-1'),
      problemDetailError('Estimated cost must be positive'),
    )
    expect(toastError).toHaveBeenCalledWith('Estimated cost must be positive')
  })

  it('useUpdateBudgetItem: toasts the backend reason on failure', () => {
    runMutationError(
      () => useUpdateBudgetItem('couple-1'),
      problemDetailError('Budget item not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Budget item not found')
  })

  it('useDeleteBudgetItem: toasts the backend reason on failure', () => {
    runMutationError(
      () => useDeleteBudgetItem('couple-1'),
      problemDetailError('Budget item not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Budget item not found')
  })
})

describe('ceremony section mutation error toasts (issue #262)', () => {
  it('useCreateCeremonySection: toasts the backend reason on failure', () => {
    runMutationError(
      () => useCreateCeremonySection('couple-1'),
      problemDetailError('Title must not be blank'),
    )
    expect(toastError).toHaveBeenCalledWith('Title must not be blank')
  })

  it('useCreateCeremonySection: falls back to the generic message with no ProblemDetail', () => {
    runMutationError(() => useCreateCeremonySection('couple-1'), new Error('network error'))
    expect(toastError).toHaveBeenCalledWith(DEFAULT_ERROR_MESSAGE)
  })

  it('useUpdateCeremonySection: toasts the backend reason on failure', () => {
    runMutationError(
      () => useUpdateCeremonySection('couple-1'),
      problemDetailError('Ceremony section not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Ceremony section not found')
  })

  it('useDeleteCeremonySection: toasts the backend reason on failure', () => {
    runMutationError(
      () => useDeleteCeremonySection('couple-1'),
      problemDetailError('Ceremony section not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Ceremony section not found')
  })
})

describe('seating table mutation error toasts (issue #262)', () => {
  it('useCreateSeatingTable: toasts the backend reason on failure', () => {
    runMutationError(
      () => useCreateSeatingTable('couple-1'),
      problemDetailError('Table name must not be blank'),
    )
    expect(toastError).toHaveBeenCalledWith('Table name must not be blank')
  })

  it('useCreateSeatingTable: falls back to the generic message with no ProblemDetail', () => {
    runMutationError(() => useCreateSeatingTable('couple-1'), new Error('network error'))
    expect(toastError).toHaveBeenCalledWith(DEFAULT_ERROR_MESSAGE)
  })

  it('useUpdateSeatingTable: toasts the backend reason on failure', () => {
    runMutationError(
      () => useUpdateSeatingTable('couple-1'),
      problemDetailError('Seating table not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Seating table not found')
  })

  it('useDeleteSeatingTable: toasts the backend reason on failure', () => {
    runMutationError(
      () => useDeleteSeatingTable('couple-1'),
      problemDetailError('Seating table not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Seating table not found')
  })
})

describe('hotel mutation error toasts (issue #262)', () => {
  it('useAddHotel: toasts the backend reason on failure', () => {
    runMutationError(
      () => useAddHotel('website-1'),
      problemDetailError('Hotel name must not be blank'),
    )
    expect(toastError).toHaveBeenCalledWith('Hotel name must not be blank')
  })

  it('useAddHotel: falls back to the generic message with no ProblemDetail', () => {
    runMutationError(() => useAddHotel('website-1'), new Error('network error'))
    expect(toastError).toHaveBeenCalledWith(DEFAULT_ERROR_MESSAGE)
  })

  it('useUpdateHotel: toasts the backend reason on failure', () => {
    runMutationError(
      () => useUpdateHotel('website-1'),
      problemDetailError('Hotel not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Hotel not found')
  })

  it('useDeleteHotel: toasts the backend reason on failure', () => {
    runMutationError(
      () => useDeleteHotel('website-1'),
      problemDetailError('Hotel not found'),
    )
    expect(toastError).toHaveBeenCalledWith('Hotel not found')
  })
})
