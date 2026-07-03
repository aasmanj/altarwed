import { describe, it, expect } from 'vitest'
import { computeGuestStats } from './guestStats'
import type { Guest } from './useGuests'

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

// Regression fixture for the bug this file exists to prevent: the Dashboard's RSVP tally
// and the Guest List page's stat tiles independently re-derived this arithmetic and drifted
// apart twice (once on the headcount, once on the response-rate denominator). Both pages
// must now read these numbers from computeGuestStats, and this fixture pins the exact
// scenario that was verified in-browser against both pages.
describe('computeGuestStats', () => {
  it('adds a confirmed, named plus-one to the ATTENDING headcount and the total, but not the record counts', () => {
    const guests = [
      makeGuest({ name: 'Andrew', rsvpStatus: 'ATTENDING', plusOneAllowed: true, plusOneName: 'Jamie' }),
      makeGuest({ name: 'Diana', rsvpStatus: 'PENDING' }),
      makeGuest({ name: 'Caleb', rsvpStatus: 'PENDING' }),
      makeGuest({ name: 'Aaron', rsvpStatus: 'PENDING' }),
      makeGuest({ name: 'Bethany', rsvpStatus: 'PENDING' }),
    ]

    const stats = computeGuestStats(guests)

    expect(stats.attendingRecords).toBe(1)
    expect(stats.confirmedPlusOnes).toBe(1)
    expect(stats.attending).toBe(2)
    expect(stats.total).toBe(6)
    expect(stats.pending).toBe(4)
    expect(stats.declining).toBe(0)
  })

  it('does not count an unnamed or unallowed plus-one toward the headcount', () => {
    const guests = [
      makeGuest({ name: 'A', rsvpStatus: 'ATTENDING', plusOneAllowed: true, plusOneName: null }),
      makeGuest({ name: 'B', rsvpStatus: 'ATTENDING', plusOneAllowed: false, plusOneName: 'Ghost' }),
    ]

    const stats = computeGuestStats(guests)

    expect(stats.attendingRecords).toBe(2)
    expect(stats.attending).toBe(2)
    expect(stats.total).toBe(2)
  })

  it('a plus-one on a DECLINING or PENDING guest still counts toward total, but never toward attending', () => {
    const guests = [
      makeGuest({ name: 'A', rsvpStatus: 'DECLINING', plusOneAllowed: true, plusOneName: 'X' }),
      makeGuest({ name: 'B', rsvpStatus: 'PENDING', plusOneAllowed: true, plusOneName: 'Y' }),
    ]

    const stats = computeGuestStats(guests)

    expect(stats.attending).toBe(0)
    expect(stats.total).toBe(4)
  })

  it('computes response rate against respondable guests (invited-or-replied), not the full roster', () => {
    const guests = [
      makeGuest({ name: 'Replied', rsvpStatus: 'ATTENDING' }),
      makeGuest({ name: 'InvitedNoReply', rsvpStatus: 'PENDING', inviteSentAt: '2026-01-01T00:00:00Z' }),
      makeGuest({ name: 'NotYetInvited1', rsvpStatus: 'PENDING' }),
      makeGuest({ name: 'NotYetInvited2', rsvpStatus: 'PENDING' }),
    ]

    const stats = computeGuestStats(guests)

    // respondable = Replied (responded) + InvitedNoReply (invited) = 2; 1 of those replied.
    expect(stats.respondable).toBe(2)
    expect(stats.responseRate).toBe(50)
    expect(stats.notYetInvited).toBe(3)
  })

  it('returns zeros without dividing by zero on an empty guest list', () => {
    const stats = computeGuestStats([])

    expect(stats.total).toBe(0)
    expect(stats.attending).toBe(0)
    expect(stats.respondable).toBe(0)
    expect(stats.responseRate).toBe(0)
  })
})
