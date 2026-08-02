import { describe, it, expect } from 'vitest'
import type { Guest } from '@/features/couple/guests/useGuests'
import {
  guestSeats,
  partyHeadcountById,
  groupUnassignedByParty,
  isSeated,
  countUnseatedAttending,
  rsvpStatusLabel,
  rsvpColorClass,
  seatedNonAttendingFlag,
} from './seatingGroups'

// Issue #548: seating became household-aware and RSVP-aware. These pure helpers are the
// load-bearing logic (party grouping + the unseated-attending count) and are asserted here
// as functions, independent of the React rendering. Each case fails on the pre-change code
// (the helpers did not exist and the pool was flat / one-person-at-a-time).

// Minimal Guest factory: only the fields the seating helpers read matter; everything else
// gets a harmless default so the tests stay focused.
function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    coupleId: 'c1',
    name: overrides.name ?? 'Guest',
    email: null,
    phone: null,
    rsvpStatus: overrides.rsvpStatus ?? 'PENDING',
    plusOneAllowed: overrides.plusOneAllowed ?? false,
    plusOneName: overrides.plusOneName ?? null,
    dietaryRestrictions: null,
    songRequest: null,
    tableNumber: overrides.tableNumber ?? null,
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
    partyId: overrides.partyId ?? null,
    partyName: overrides.partyName ?? null,
    partyContact: null,
    saveTheDateDeliveryStatus: null,
    inviteDeliveryStatus: null,
    emailUnsubscribed: null,
    emailUnsubscribedReason: null,
    ...overrides,
  }
}

describe('guestSeats', () => {
  it('counts one seat for a lone guest', () => {
    expect(guestSeats(guest())).toBe(1)
  })

  it('counts two seats when a named plus-one rides along', () => {
    expect(guestSeats(guest({ plusOneName: 'Sam' }))).toBe(2)
  })

  it('does not reserve a seat for an unnamed (not-yet-real) plus-one', () => {
    expect(guestSeats(guest({ plusOneAllowed: true, plusOneName: null }))).toBe(1)
  })
})

describe('partyHeadcountById', () => {
  it('sums seats per household and ignores guests with no party', () => {
    const map = partyHeadcountById([
      guest({ partyId: 'p1', partyName: 'Smith', plusOneName: 'Jane' }), // 2
      guest({ partyId: 'p1', partyName: 'Smith' }), // 1
      guest({ partyId: 'p2', partyName: 'Doe' }), // 1
      guest({ partyId: null }), // ignored
    ])
    expect(map.get('p1')).toBe(3)
    expect(map.get('p2')).toBe(1)
    expect(map.has('')).toBe(false)
  })
})

describe('groupUnassignedByParty', () => {
  it('groups households of 2+ and drops singles under individuals', () => {
    const g = groupUnassignedByParty([
      guest({ id: 'a', name: 'Anna Smith', partyId: 'p1', partyName: 'Smith Family' }),
      guest({ id: 'b', name: 'Bob Smith', partyId: 'p1', partyName: 'Smith Family' }),
      guest({ id: 'c', name: 'Cara Lone', partyId: null }),
    ])
    expect(g.parties).toHaveLength(1)
    expect(g.parties[0].partyName).toBe('Smith Family')
    expect(g.parties[0].guests).toHaveLength(2)
    expect(g.parties[0].headcount).toBe(2)
    expect(g.individuals.map(x => x.id)).toEqual(['c'])
  })

  it('treats a lone remaining party member as an individual (no batching win)', () => {
    const g = groupUnassignedByParty([
      guest({ id: 'a', name: 'Only Member', partyId: 'p1', partyName: 'Smith Family' }),
      guest({ id: 'b', name: 'Zed Alone', partyId: null }),
    ])
    expect(g.parties).toHaveLength(0)
    expect(g.individuals.map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('sums seats including plus-ones for the group headcount', () => {
    const g = groupUnassignedByParty([
      guest({ partyId: 'p1', partyName: 'Jones', plusOneName: 'Plus' }), // 2
      guest({ partyId: 'p1', partyName: 'Jones' }), // 1
    ])
    expect(g.parties[0].headcount).toBe(3)
  })

  it('sorts parties by name and individuals by name', () => {
    const g = groupUnassignedByParty([
      guest({ id: 'z', name: 'Zoe', partyId: null }),
      guest({ id: 'a', name: 'Aaron', partyId: null }),
      guest({ partyId: 'p2', partyName: 'Brown' }),
      guest({ partyId: 'p2', partyName: 'Brown' }),
      guest({ partyId: 'p1', partyName: 'Adams' }),
      guest({ partyId: 'p1', partyName: 'Adams' }),
    ])
    expect(g.parties.map(p => p.partyName)).toEqual(['Adams', 'Brown'])
    expect(g.individuals.map(i => i.name)).toEqual(['Aaron', 'Zoe'])
  })

  it('falls back to a generic household label when the party name is blank', () => {
    const g = groupUnassignedByParty([
      guest({ partyId: 'p1', partyName: '  ' }),
      guest({ partyId: 'p1', partyName: '  ' }),
    ])
    expect(g.parties[0].partyName).toBe('Household')
  })
})

describe('isSeated', () => {
  it('is seated only when tableNumber points at an existing table', () => {
    expect(isSeated(guest({ tableNumber: 1 }), 3)).toBe(true)
    expect(isSeated(guest({ tableNumber: 3 }), 3)).toBe(true)
    expect(isSeated(guest({ tableNumber: null }), 3)).toBe(false)
    // Stale number left over after a table delete: no longer a valid seat.
    expect(isSeated(guest({ tableNumber: 4 }), 3)).toBe(false)
    expect(isSeated(guest({ tableNumber: 1 }), 0)).toBe(false)
  })
})

describe('countUnseatedAttending', () => {
  it('counts only attending guests missing a valid table', () => {
    const guests = [
      guest({ rsvpStatus: 'ATTENDING', tableNumber: null }), // counts
      guest({ rsvpStatus: 'ATTENDING', tableNumber: 5 }), // stale table -> counts
      guest({ rsvpStatus: 'ATTENDING', tableNumber: 1 }), // seated -> no
      guest({ rsvpStatus: 'DECLINING', tableNumber: null }), // not attending -> no
      guest({ rsvpStatus: 'PENDING', tableNumber: null }), // not attending -> no
    ]
    expect(countUnseatedAttending(guests, 3)).toBe(2)
  })

  it('is zero when every attending guest is seated', () => {
    expect(countUnseatedAttending([
      guest({ rsvpStatus: 'ATTENDING', tableNumber: 1 }),
      guest({ rsvpStatus: 'DECLINING', tableNumber: null }),
    ], 2)).toBe(0)
  })
})

describe('rsvp presentation', () => {
  it('labels each status in guest-facing language', () => {
    expect(rsvpStatusLabel('ATTENDING')).toBe('Attending')
    expect(rsvpStatusLabel('DECLINING')).toBe('Declined')
    expect(rsvpStatusLabel('PENDING')).toBe('Awaiting reply')
  })

  it('maps each status to a distinct color token', () => {
    const colors = new Set([
      rsvpColorClass('ATTENDING'),
      rsvpColorClass('DECLINING'),
      rsvpColorClass('PENDING'),
    ])
    expect(colors.size).toBe(3)
  })
})

describe('seatedNonAttendingFlag', () => {
  it('flags a seated declined guest loudly', () => {
    expect(seatedNonAttendingFlag(guest({ rsvpStatus: 'DECLINING' }), true))
      .toEqual({ label: 'Declined', tone: 'danger' })
  })

  it('softly flags a seated pending guest', () => {
    expect(seatedNonAttendingFlag(guest({ rsvpStatus: 'PENDING' }), true))
      .toEqual({ label: 'No reply', tone: 'muted' })
  })

  it('never flags an attending or an unseated guest', () => {
    expect(seatedNonAttendingFlag(guest({ rsvpStatus: 'ATTENDING' }), true)).toBeNull()
    expect(seatedNonAttendingFlag(guest({ rsvpStatus: 'DECLINING' }), false)).toBeNull()
  })
})
