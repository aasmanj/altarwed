import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #296: the vendor Upgrade (Stripe Checkout) and Manage Billing (Customer
// Portal) mutations had onSuccess (redirect) but no onError, so a 500 or timeout
// on the only money-taking surface in the product flipped the button back with
// zero feedback. Both hooks now toast an actionable message on failure, and when
// the backend sends an RFC 7807 ProblemDetail its `detail` is surfaced verbatim.
//
// Harness mirrors mutationErrorToasts.test.ts (issue #222): sonner is mocked, and
// useMutation is mocked to hand back the options object the hook built, giving us
// the genuine onError closure to exercise exactly as React Query would on failure.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
}))

type AnyMutationOptions = {
  onSuccess?: (data: unknown) => void
  onError?: (err: unknown, vars: unknown, ctx: unknown) => void
}

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => new actual.QueryClient(),
    useMutation: (options: AnyMutationOptions) => options,
  }
})

import {
  useCreateCheckoutSession,
  useCreatePortalSession,
  CHECKOUT_ERROR_MESSAGE,
  PORTAL_ERROR_MESSAGE,
} from './useSubscription'

// A Spring ProblemDetail rejection, shaped like the axios error errorDetail reads.
function problemDetailError(detail: string) {
  return { response: { data: { detail } } }
}

function runMutationError(hook: () => unknown, err: unknown) {
  const options = hook() as AnyMutationOptions
  options.onError?.(err, undefined, undefined)
}

beforeEach(() => {
  toastError.mockClear()
})

describe('vendor Stripe checkout error surfacing (issue #296)', () => {
  it('toasts the actionable checkout fallback on a bare failure (5xx / timeout)', () => {
    runMutationError(() => useCreateCheckoutSession(), new Error('Network Error'))
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith(CHECKOUT_ERROR_MESSAGE)
  })

  it('surfaces the backend ProblemDetail reason when present', () => {
    runMutationError(
      () => useCreateCheckoutSession(),
      problemDetailError('Billing is not configured for this account'),
    )
    expect(toastError).toHaveBeenCalledWith('Billing is not configured for this account')
  })

  it('checkout hook wires an onError handler (would be undefined pre-fix)', () => {
    const options = useCreateCheckoutSession() as unknown as AnyMutationOptions
    expect(typeof options.onError).toBe('function')
  })
})

describe('vendor Stripe billing portal error surfacing (issue #296)', () => {
  it('toasts the actionable portal fallback on a bare failure (5xx / timeout)', () => {
    runMutationError(() => useCreatePortalSession(), new Error('Network Error'))
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith(PORTAL_ERROR_MESSAGE)
  })

  it('surfaces the backend ProblemDetail reason when present', () => {
    runMutationError(
      () => useCreatePortalSession(),
      problemDetailError('No Stripe customer exists for this vendor'),
    )
    expect(toastError).toHaveBeenCalledWith('No Stripe customer exists for this vendor')
  })

  it('portal hook wires an onError handler (would be undefined pre-fix)', () => {
    const options = useCreatePortalSession() as unknown as AnyMutationOptions
    expect(typeof options.onError).toBe('function')
  })
})

describe('actionable copy (acceptance criterion 1)', () => {
  it('both fallbacks tell the vendor what failed and what to do next', () => {
    expect(CHECKOUT_ERROR_MESSAGE).toBe('Could not open checkout. Please try again.')
    expect(PORTAL_ERROR_MESSAGE).toBe('Could not open billing management. Please try again.')
  })
})
