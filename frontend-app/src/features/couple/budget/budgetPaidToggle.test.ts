import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #300: the budget Paid toggle is the most-repeated click on the budget
// page and had no optimistic update, so on a slow connection couples saw a
// second-plus of dead air and double-tapped. useUpdateBudgetItem now flips the
// cached item in onMutate and recomputes the summary's derived totals from the
// cache; onError restores the snapshot and toasts; onSettled invalidates so the
// server's authoritative totals win.
//
// Same DOM-free technique as optimisticRollbackToasts.test.ts: the hook only
// calls useQueryClient and useMutation, so we mock those two. useQueryClient
// returns a shared real QueryClient we seed, and useMutation hands back the
// options object, giving us the genuine onMutate/onError/onSettled closures to
// run exactly as React Query would.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
}))

type AnyMutationOptions = {
  onMutate?: (vars: unknown) => Promise<unknown> | unknown
  onError?: (err: unknown, vars: unknown, ctx: unknown) => void
  onSettled?: () => void
}

let sharedClient: import('@tanstack/react-query').QueryClient

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => sharedClient,
    // Return the options object itself so the test can reach the callbacks.
    useMutation: (options: AnyMutationOptions) => options,
  }
})

import { QueryClient } from '@tanstack/react-query'
import { useUpdateBudgetItem, BudgetSummary, BudgetItem } from './useBudget'

const KEY = ['budget', 'couple-1']

function makeItem(overrides: Partial<BudgetItem>): BudgetItem {
  return {
    id: 'b1',
    coupleId: 'couple-1',
    category: 'FLOWERS',
    vendorName: 'Florist',
    estimatedCost: 1000,
    actualCost: 1000,
    isPaid: false,
    notes: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

// Seed mirrors what the backend would return for these items: florist unpaid,
// venue paid, so totalPaid only counts the venue.
function seedSummary(): BudgetSummary {
  return {
    totalBudget: 6000,
    totalActual: 5500,
    totalPaid: 4500,
    totalRemaining: 1000,
    items: [
      makeItem({ id: 'b1', vendorName: 'Florist', estimatedCost: 1000, actualCost: 1000, isPaid: false }),
      makeItem({ id: 'b2', vendorName: 'Venue', category: 'VENUE', estimatedCost: 5000, actualCost: 4500, isPaid: true }),
    ],
  }
}

// At runtime the mocked useMutation returns the raw options object, but the
// hook is typed to return UseMutationResult, so each test passes the hook as
// an inline thunk and we narrow here. The thunk (not a direct call inside this
// named function) also keeps react-hooks/rules-of-hooks quiet, same as
// optimisticRollbackToasts.test.ts.
function setup(seed: BudgetSummary, hook: () => unknown) {
  sharedClient = new QueryClient()
  sharedClient.setQueryData(KEY, seed)
  return hook() as AnyMutationOptions
}

beforeEach(() => {
  toastError.mockClear()
})

describe('budget paid toggle optimistic update (issue #300)', () => {
  it('onMutate flips isPaid in the cache immediately and recomputes totals', async () => {
    const options = setup(seedSummary(), () => useUpdateBudgetItem('couple-1'))

    await options.onMutate?.({ itemId: 'b1', isPaid: true })

    const after = sharedClient.getQueryData<BudgetSummary>(KEY)
    expect(after?.items.find(i => i.id === 'b1')?.isPaid).toBe(true)
    // Florist's $1000 actual now counts as paid: 4500 + 1000.
    expect(after?.totalPaid).toBe(5500)
    expect(after?.totalRemaining).toBe(0)
    // Untouched totals stay put.
    expect(after?.totalBudget).toBe(6000)
    expect(after?.totalActual).toBe(5500)
  })

  it('onMutate unpaying an item removes its actual cost from totalPaid', async () => {
    const options = setup(seedSummary(), () => useUpdateBudgetItem('couple-1'))

    await options.onMutate?.({ itemId: 'b2', isPaid: false })

    const after = sharedClient.getQueryData<BudgetSummary>(KEY)
    expect(after?.items.find(i => i.id === 'b2')?.isPaid).toBe(false)
    expect(after?.totalPaid).toBe(0)
    expect(after?.totalRemaining).toBe(5500)
  })

  it('paying an item with no actual cost flips the flag without changing totals', async () => {
    const seed = seedSummary()
    seed.items[0] = makeItem({ id: 'b1', actualCost: null, isPaid: false })
    seed.totalActual = 4500
    seed.totalRemaining = 0
    const options = setup(seed, () => useUpdateBudgetItem('couple-1'))

    await options.onMutate?.({ itemId: 'b1', isPaid: true })

    const after = sharedClient.getQueryData<BudgetSummary>(KEY)
    expect(after?.items.find(i => i.id === 'b1')?.isPaid).toBe(true)
    // A null actual contributes nothing, matching BudgetItemService.getSummary.
    expect(after?.totalPaid).toBe(4500)
    expect(after?.totalActual).toBe(4500)
    expect(after?.totalRemaining).toBe(0)
  })

  it('onError restores the snapshot and surfaces an error toast', async () => {
    const seed = seedSummary()
    const options = setup(seed, () => useUpdateBudgetItem('couple-1'))

    const vars = { itemId: 'b1', isPaid: true }
    const ctx = await options.onMutate?.(vars)
    // The optimistic flip landed before the failure.
    expect(sharedClient.getQueryData<BudgetSummary>(KEY)?.totalPaid).toBe(5500)

    options.onError?.(new Error('boom'), vars, ctx)

    // Full summary (items and totals) is back to the pre-mutation snapshot.
    expect(sharedClient.getQueryData<BudgetSummary>(KEY)).toEqual(seed)
    expect(toastError).toHaveBeenCalledTimes(1)
    const msg = String(toastError.mock.calls[0][0])
    expect(msg.length).toBeGreaterThan(0)
  })

  it('onSettled invalidates the budget query so server totals reconcile', () => {
    const options = setup(seedSummary(), () => useUpdateBudgetItem('couple-1'))
    const invalidate = vi.spyOn(sharedClient, 'invalidateQueries')

    options.onSettled?.()

    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY })
  })
})
