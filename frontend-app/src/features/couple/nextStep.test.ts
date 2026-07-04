import { describe, it, expect } from 'vitest'
import { computeNextStep, dismissalStorageKey, readDismissed } from './nextStep'
import { computeGuestStats } from './guests/guestStats'
import type { Guest } from './guests/useGuests'

function makeGuest(overrides: Partial<Guest> & { name: string }): Guest {
  return {
    id: overrides.name,
    coupleId: 'couple-1',
    email: null,
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
    inviteSendCount: null,
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
    ...overrides,
  }
}

function decideFor(guests: Guest[]) {
  return computeNextStep(guests, computeGuestStats(guests))
}

describe('computeNextStep rule ordering (first match wins)', () => {
  it('Rule 1: no guests -> add your guest list', () => {
    const nudge = decideFor([])
    expect(nudge?.stage).toBe('ADD_GUESTS')
    expect(nudge?.href).toBe('/dashboard/guests')
  })

  it('Rule 2: guests exist but none have a save-the-date sent -> send save-the-dates', () => {
    const nudge = decideFor([
      makeGuest({ name: 'A' }),
      makeGuest({ name: 'B' }),
    ])
    expect(nudge?.stage).toBe('SEND_SAVE_THE_DATES')
    expect(nudge?.href).toBe('/dashboard/save-the-date')
  })

  it('Rule 3: save-the-dates sent but no RSVP invites sent -> invite guests to RSVP', () => {
    const nudge = decideFor([
      makeGuest({ name: 'A', saveTheDateSentAt: '2026-01-01T00:00:00Z' }),
      // inviteSendCount left null: a boxed null means "never invited", not zero-invited.
      makeGuest({ name: 'B', saveTheDateSentAt: '2026-01-01T00:00:00Z' }),
    ])
    expect(nudge?.stage).toBe('SEND_INVITES')
    expect(nudge?.href).toBe('/dashboard/guests')
  })

  it('Rule 3 boundary: an explicit inviteSendCount of 0 still counts as not-yet-invited', () => {
    const nudge = decideFor([
      makeGuest({ name: 'A', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 0 }),
    ])
    expect(nudge?.stage).toBe('SEND_INVITES')
  })

  it('Rule 4: invites sent and some guests still pending -> N have not responded', () => {
    const nudge = decideFor([
      makeGuest({ name: 'A', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'ATTENDING' }),
      makeGuest({ name: 'B', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'PENDING' }),
      makeGuest({ name: 'C', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'PENDING' }),
    ])
    expect(nudge?.stage).toBe('AWAIT_RSVPS')
    expect(nudge?.message).toBe('2 guests have not responded yet.')
    expect(nudge?.href).toBe('/dashboard/guests')
  })

  it('Rule 4 pending count matches computeGuestStats.pending (never contradicts the RSVP tile)', () => {
    const guests = [
      makeGuest({ name: 'A', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'ATTENDING' }),
      makeGuest({ name: 'B', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'PENDING' }),
    ]
    const nudge = computeNextStep(guests, computeGuestStats(guests))
    expect(nudge?.message).toBe('1 guest has not responded yet.')
  })

  it('Rule 5: invites sent and no one is pending -> nothing to nudge', () => {
    const nudge = decideFor([
      makeGuest({ name: 'A', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'ATTENDING' }),
      makeGuest({ name: 'B', saveTheDateSentAt: '2026-01-01T00:00:00Z', inviteSendCount: 1, rsvpStatus: 'DECLINING' }),
    ])
    expect(nudge).toBeNull()
  })

  it('first-match-wins: an earlier unmet stage beats later-stage signals on the same data', () => {
    // Contrived data where nobody has a save-the-date yet, but they somehow carry invite/RSVP
    // signals. Rule 2 (no save-the-date sent to anyone) must still win over Rules 3 and 4, since
    // it is checked first. This pins the ordering, not just the individual rule conditions.
    const nudge = decideFor([
      makeGuest({ name: 'A', inviteSendCount: 1, rsvpStatus: 'ATTENDING' }),
      makeGuest({ name: 'B', inviteSendCount: 1, rsvpStatus: 'PENDING' }),
    ])
    expect(nudge?.stage).toBe('SEND_SAVE_THE_DATES')
  })
})

describe('dismissalStorageKey (per couple, per stage)', () => {
  it('scopes the key by both couple id and stage', () => {
    expect(dismissalStorageKey('couple-1', 'ADD_GUESTS')).toBe('altarwed:nextstep-dismissed:couple-1:ADD_GUESTS')
  })

  it('different couples on one browser get different keys for the same stage', () => {
    expect(dismissalStorageKey('couple-1', 'SEND_INVITES'))
      .not.toBe(dismissalStorageKey('couple-2', 'SEND_INVITES'))
  })

  it('different stages for one couple get different keys, so dismissal is per stage', () => {
    expect(dismissalStorageKey('couple-1', 'ADD_GUESTS'))
      .not.toBe(dismissalStorageKey('couple-1', 'SEND_SAVE_THE_DATES'))
  })
})

// Fake Storage backed by a plain map, so these stay pure (no DOM / jsdom needed).
function fakeStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem'> {
  return { getItem: (k: string) => (k in initial ? initial[k] : null) }
}

describe('readDismissed', () => {
  it('is false when nothing is stored for the stage', () => {
    expect(readDismissed('couple-1', 'ADD_GUESTS', fakeStorage())).toBe(false)
  })

  it('is true only when the exact per-couple, per-stage key holds "1"', () => {
    const storage = fakeStorage({ [dismissalStorageKey('couple-1', 'ADD_GUESTS')]: '1' })
    expect(readDismissed('couple-1', 'ADD_GUESTS', storage)).toBe(true)
  })

  it('advancing to a new stage is NOT suppressed by the previous stage being dismissed', () => {
    // Regression for the in-place stage advance bug: dismissing ADD_GUESTS must not hide the
    // next stage's nudge once the couple progresses (React Query can advance the stage without
    // remounting the card, so the component re-reads dismissal per stage via this function).
    const storage = fakeStorage({ [dismissalStorageKey('couple-1', 'ADD_GUESTS')]: '1' })
    expect(readDismissed('couple-1', 'ADD_GUESTS', storage)).toBe(true)
    expect(readDismissed('couple-1', 'SEND_SAVE_THE_DATES', storage)).toBe(false)
  })

  it('another couple on the same browser does not inherit a dismissal', () => {
    const storage = fakeStorage({ [dismissalStorageKey('couple-1', 'ADD_GUESTS')]: '1' })
    expect(readDismissed('couple-2', 'ADD_GUESTS', storage)).toBe(false)
  })

  it('treats a missing or throwing storage as not dismissed rather than crashing', () => {
    expect(readDismissed('couple-1', 'ADD_GUESTS', null)).toBe(false)
    const throwing: Pick<Storage, 'getItem'> = {
      getItem: () => { throw new Error('storage disabled') },
    }
    expect(readDismissed('couple-1', 'ADD_GUESTS', throwing)).toBe(false)
  })
})
