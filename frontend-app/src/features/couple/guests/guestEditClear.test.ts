import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #305: two halves of the guest edit-row clearing bug.
//
// 1. The general guest PATCH uses null-means-not-provided merge semantics, so it
//    can never clear tableNumber; axios drops undefined from the JSON body, so
//    the old payload's `tableNumber: undefined` was a silent no-op. The edit row
//    must route every table change (assign AND clear) through the dedicated
//    seating PUT, whose null unambiguously means unassign.
// 2. useUpdateGuest.onMutate used to spread the raw payload into the cached
//    guest, so those undefined keys optimistically blanked fields the server
//    would never change, then the UI silently reverted on response. onMutate
//    must strip undefined keys before spreading.
//
// No DOM needed: useMutation/useQueryClient are mocked so the hooks hand back
// their real option closures (same pattern as optimisticRollbackToasts.test.ts),
// and buildGuestSavePlan is a pure function.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
}))

const { putSpy } = vi.hoisted(() => ({
  putSpy: vi.fn(() => Promise.resolve({ data: { id: 'g1' } })),
}))
vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    put: putSpy,
    delete: vi.fn(),
  },
}))

type AnyMutationOptions = {
  mutationFn?: (vars: never) => Promise<unknown>
  onMutate?: (vars: unknown) => Promise<unknown> | unknown
}

let sharedClient: import('@tanstack/react-query').QueryClient

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => sharedClient,
    // Return the options object itself so tests can reach mutationFn/onMutate.
    useMutation: (options: AnyMutationOptions) => options,
  }
})

import { QueryClient } from '@tanstack/react-query'
import { useUpdateGuest, useAssignGuestTable, type Guest } from './useGuests'
import { buildGuestSavePlan, type GuestEditForm } from './guestEditSave'

const baseForm: GuestEditForm = {
  name: 'Ada', email: 'a@example.com', phone: '', side: 'BRIDE', party: '',
  status: 'PENDING', table: '', plusOne: false, song: '',
  mailLine1: '', mailCity: '', mailState: '', mailZip: '', mailCountry: '',
}

beforeEach(() => {
  putSpy.mockClear()
  sharedClient = new QueryClient()
})

describe('buildGuestSavePlan (edit-row save routing, issue #305)', () => {
  it('routes clearing the table through the PUT as null and keeps tableNumber off the PATCH', () => {
    const plan = buildGuestSavePlan({ tableNumber: 4 }, { ...baseForm, table: '' })
    expect(plan.tableNumber).toBeNull()
    expect('tableNumber' in plan.patchPayload).toBe(false)
  })

  it('routes assigning a table through the PUT too', () => {
    const plan = buildGuestSavePlan({ tableNumber: 4 }, { ...baseForm, table: '7' })
    expect(plan.tableNumber).toBe(7)
    expect('tableNumber' in plan.patchPayload).toBe(false)
  })

  it('skips the PUT entirely when the table did not change', () => {
    expect(buildGuestSavePlan({ tableNumber: 4 }, { ...baseForm, table: '4' }).tableNumber)
      .toBeUndefined()
    expect(buildGuestSavePlan({ tableNumber: null }, { ...baseForm, table: '' }).tableNumber)
      .toBeUndefined()
  })

  it('sends side as undefined (not empty string) when blank, so the PATCH ignores it', () => {
    const plan = buildGuestSavePlan({ tableNumber: null }, { ...baseForm, side: '' })
    expect(plan.patchPayload.side).toBeUndefined()
  })
})

describe('useAssignGuestTable request shape', () => {
  it('a table clear issues PUT /table with an explicit null body value', async () => {
    const options = useAssignGuestTable('couple-1') as unknown as AnyMutationOptions
    await options.mutationFn!({ guestId: 'g1', tableNumber: null } as never)
    expect(putSpy).toHaveBeenCalledWith(
      '/api/v1/guests/couple/couple-1/g1/table',
      { tableNumber: null },
    )
  })
})

describe('useUpdateGuest.onMutate undefined-stripping', () => {
  it('does not optimistically blank fields the payload sends as undefined', async () => {
    const seed = [
      { id: 'g1', name: 'Ada', tableNumber: 4, side: 'BRIDE' } as unknown as Guest,
    ]
    sharedClient.setQueryData(['guests', 'couple-1'], seed)

    const options = useUpdateGuest('couple-1') as unknown as AnyMutationOptions
    await options.onMutate?.({
      guestId: 'g1',
      payload: { name: 'Grace', side: undefined, tableNumber: undefined },
    })

    const after = sharedClient.getQueryData<Guest[]>(['guests', 'couple-1'])!
    expect(after[0].name).toBe('Grace')
    // Before the fix these were both optimistically wiped to undefined and the
    // row showed a clear the server would never make.
    expect(after[0].tableNumber).toBe(4)
    expect(after[0].side).toBe('BRIDE')
  })
})
