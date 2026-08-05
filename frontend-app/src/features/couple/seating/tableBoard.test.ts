import { describe, it, expect } from 'vitest'
import type { Guest } from '@/features/couple/guests/useGuests'
import type { SeatingTable } from './useSeatingTables'
import { buildTableGroups } from './tableBoard'

// Issue #556: by-table seating board / table cards. The printed groups must agree
// with the alphabetical board on exactly who is coming and where they sit, so the
// exclusions (declined, unseated, stale table number, empty table) are asserted
// here rather than trusted to the JSX.

function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    coupleId: 'c1',
    name: overrides.name ?? 'Guest',
    email: null,
    phone: null,
    rsvpStatus: overrides.rsvpStatus ?? 'ATTENDING',
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

function table(id: string, name: string, capacity = 8): SeatingTable {
  return { id, coupleId: 'c1', name, capacity, sortOrder: 0 }
}

const tables = [table('t1', 'Head Table'), table('t2', 'Table 2'), table('t3', 'Table 3')]

describe('buildTableGroups', () => {
  it('groups seated guests under their table, in table order', () => {
    const groups = buildTableGroups(
      [
        guest({ id: 'a', name: 'Zoe Adams', tableNumber: 2 }),
        guest({ id: 'b', name: 'Carl Baker', tableNumber: 1 }),
      ],
      tables,
    )
    expect(groups.map(g => [g.tableNumber, g.tableLabel, g.names])).toEqual([
      [1, 'Head Table', ['Carl Baker']],
      [2, 'Table 2', ['Zoe Adams']],
    ])
    // Key is the table id, so React reconciliation survives a table rename.
    expect(groups.map(g => g.key)).toEqual(['t1', 't2'])
  })

  it('sorts names within a table by last name, falling back to full name', () => {
    const groups = buildTableGroups(
      [
        guest({ id: 'a', name: 'Amy Zimmer', tableNumber: 1 }),
        guest({ id: 'b', name: 'Carl Baker', tableNumber: 1 }),
        guest({ id: 'c', name: 'Zoe Adams', tableNumber: 1 }),
      ],
      tables,
    )
    expect(groups[0].names).toEqual(['Zoe Adams', 'Carl Baker', 'Amy Zimmer'])
  })

  it('gives a named plus-one their own line at the same table, sorted by their own last name', () => {
    const groups = buildTableGroups(
      [guest({ id: 'a', name: 'Anna Smith', plusOneName: 'Ben Jones', tableNumber: 1 })],
      tables,
    )
    expect(groups[0].names).toEqual(['Ben Jones', 'Anna Smith'])
  })

  it('does not list an unnamed plus-one', () => {
    const groups = buildTableGroups(
      [guest({ id: 'a', name: 'Anna', plusOneAllowed: true, plusOneName: null, tableNumber: 1 })],
      tables,
    )
    expect(groups[0].names).toEqual(['Anna'])
  })

  it('excludes declined guests, matching the printed board', () => {
    const groups = buildTableGroups(
      [guest({ id: 'a', name: 'Gone Away', rsvpStatus: 'DECLINING', tableNumber: 1 })],
      tables,
    )
    expect(groups).toHaveLength(0)
  })

  it('excludes guests with no table and guests with a stale table number', () => {
    const groups = buildTableGroups(
      [
        guest({ id: 'a', name: 'No Seat', tableNumber: null }),
        guest({ id: 'b', name: 'Stale Seat', tableNumber: 9 }),
      ],
      tables,
    )
    expect(groups).toHaveLength(0)
  })

  it('includes a seated guest who has not replied yet', () => {
    const groups = buildTableGroups(
      [guest({ id: 'a', name: 'Maybe Coming', rsvpStatus: 'PENDING', tableNumber: 1 })],
      tables,
    )
    expect(groups[0].names).toEqual(['Maybe Coming'])
  })

  it('returns nothing when there are no tables at all', () => {
    const groups = buildTableGroups([guest({ id: 'a', name: 'Anna', tableNumber: 1 })], [])
    expect(groups).toHaveLength(0)
  })

  it('excludes a zero table number (tableNumber is 1-based)', () => {
    const groups = buildTableGroups([guest({ id: 'a', name: 'Anna', tableNumber: 0 })], tables)
    expect(groups).toHaveLength(0)
  })

  it('omits tables with nobody seated', () => {
    const groups = buildTableGroups([guest({ id: 'a', name: 'Only One', tableNumber: 3 })], tables)
    expect(groups.map(g => g.tableLabel)).toEqual(['Table 3'])
  })
})
