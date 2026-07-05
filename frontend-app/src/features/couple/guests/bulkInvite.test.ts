import { describe, it, expect, vi } from 'vitest'

// Issue #217: bulk RSVP invite send. These node-env tests cover the pure selection and
// result-summary logic behind the guest-list bulk sender, plus the hook's onError toast
// (issue #222: no new silent mutations). No DOM: we exercise the real functions and the
// real useMutation options object, exactly as the optimisticRollbackToasts suite does.

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    // Hand back the options object so the test can reach onError.
    useMutation: (options: unknown) => options,
  }
})

import {
  invitableGuests,
  unsentInvitableIds,
  summariseInviteResult,
} from './bulkInvite'
import { useSendBulkInvites, type Guest, type BulkInviteResult } from './useGuests'

const EM_DASH = String.fromCharCode(0x2014)

// Minimal guest factory; only the fields the invite rules read matter here.
function guest(over: Partial<Guest>): Guest {
  return {
    id: 'g',
    coupleId: 'c',
    name: 'Guest',
    email: 'guest@example.com',
    phone: null,
    rsvpStatus: 'PENDING',
    plusOneAllowed: false,
    plusOneName: null,
    dietaryRestrictions: null,
    songRequest: null,
    tableNumber: null,
    side: null,
    notes: null,
    mailLine1: null,
    mailCity: null,
    mailState: null,
    mailZip: null,
    mailCountry: null,
    noteForCouple: null,
    inviteSendCount: 0,
    inviteSentAt: null,
    saveTheDateSentAt: null,
    respondedAt: null,
    partyId: null,
    partyName: null,
    partyContact: null,
    saveTheDateDeliveryStatus: null,
    inviteDeliveryStatus: null,
    emailUnsubscribed: null,
    emailUnsubscribedReason: null,
    ...over,
  }
}

describe('invitableGuests', () => {
  it('keeps only pending guests with an email, not unsubscribed, under the 3-invite cap', () => {
    const pending = guest({ id: 'ok', rsvpStatus: 'PENDING', email: 'a@example.com' })
    const responded = guest({ id: 'responded', rsvpStatus: 'ATTENDING' })
    const noEmail = guest({ id: 'no-email', email: null })
    const unsubscribed = guest({ id: 'unsub', emailUnsubscribed: true })
    const overCap = guest({ id: 'cap', inviteSendCount: 3 })

    const result = invitableGuests([pending, responded, noEmail, unsubscribed, overCap])

    expect(result.map(g => g.id)).toEqual(['ok'])
  })
})

describe('unsentInvitableIds', () => {
  it('defaults to invitable guests who have never been invited', () => {
    const fresh = guest({ id: 'fresh', inviteSentAt: null })
    const alreadyInvited = guest({ id: 'invited', inviteSentAt: '2026-07-01T00:00:00', inviteSendCount: 1 })
    const responded = guest({ id: 'responded', rsvpStatus: 'DECLINING' })

    expect(unsentInvitableIds([fresh, alreadyInvited, responded])).toEqual(['fresh'])
  })
})

describe('summariseInviteResult', () => {
  it('reports only the sent count when nothing was skipped', () => {
    const result: BulkInviteResult = { sent: 5, skipped: 0, skippedGuests: [] }
    expect(summariseInviteResult(result)).toBe('Sent 5 RSVP invites.')
  })

  it('singularises a single invite', () => {
    const result: BulkInviteResult = { sent: 1, skipped: 0, skippedGuests: [] }
    expect(summariseInviteResult(result)).toBe('Sent 1 RSVP invite.')
  })

  it('groups skips by reason with friendly copy', () => {
    const result: BulkInviteResult = {
      sent: 4,
      skipped: 3,
      skippedGuests: [
        { guestId: 'a', name: 'A', reason: 'already_responded' },
        { guestId: 'b', name: 'B', reason: 'already_responded' },
        { guestId: 'c', name: 'C', reason: 'no_email' },
      ],
    }
    expect(summariseInviteResult(result)).toBe(
      'Sent 4 RSVP invites. Skipped 3: 2 already responded, 1 no email address.',
    )
  })

  it('reports an idempotent replay without a breakdown and without claiming a new send (issue #295)', () => {
    // Replays carry counts only (skip details are not stored in the receipt), so the
    // copy must make clear the retry did not email anyone twice.
    const result: BulkInviteResult = { sent: 40, skipped: 2, skippedGuests: [], replayed: true }
    expect(summariseInviteResult(result)).toBe(
      'These invites were already sent (40 sent, 2 skipped). Your retry did not email anyone twice.',
    )
  })

  it('never emits an em dash (house rule)', () => {
    const result: BulkInviteResult = {
      sent: 0,
      skipped: 1,
      skippedGuests: [{ guestId: 'a', name: 'A', reason: 'cap_reached' }],
    }
    expect(summariseInviteResult(result)).not.toContain(EM_DASH)
  })
})

describe('useSendBulkInvites', () => {
  it('surfaces a toast on error instead of failing silently (issue #222)', () => {
    const options = useSendBulkInvites('couple-1') as { onError?: (err: unknown) => void }
    toastError.mockClear()

    options.onError?.(new Error('boom'))

    expect(toastError).toHaveBeenCalledTimes(1)
    const msg = String(toastError.mock.calls[0][0])
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).not.toContain(EM_DASH)
  })
})
