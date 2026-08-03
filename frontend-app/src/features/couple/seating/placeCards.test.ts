import { describe, it, expect } from 'vitest'
import type { Guest } from '@/features/couple/guests/useGuests'
import type { SeatingTable } from './useSeatingTables'
import { buildPlaceCards, sortPlaceCards } from './placeCards'

// Issue #556: escort / place cards. The card set must agree with the printed seating
// board on exactly who is coming and where they sit, so the exclusions (declined,
// unseated, stale table number) are asserted here rather than trusted to the JSX.

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

const tables = [table('t1', 'Head Table'), table('t2', 'Table 2')]

describe('buildPlaceCards', () => {
  it('makes one card per seated guest, carrying the table name', () => {
    const cards = buildPlaceCards([guest({ id: 'a', name: 'Anna Smith', tableNumber: 1 })], tables)
    expect(cards).toEqual([
      { key: 'a', name: 'Anna Smith', tableLabel: 'Head Table', tableNumber: 1, sortKey: 'smith' },
    ])
  })

  it('gives a named plus-one their own card at the same table', () => {
    const cards = buildPlaceCards(
      [guest({ id: 'a', name: 'Anna Smith', plusOneName: 'Ben Jones', tableNumber: 2 })],
      tables,
    )
    expect(cards.map(c => [c.name, c.tableLabel])).toEqual([
      ['Anna Smith', 'Table 2'],
      ['Ben Jones', 'Table 2'],
    ])
    // Distinct React keys so the plus-one card is never reconciled onto the guest card.
    expect(new Set(cards.map(c => c.key)).size).toBe(2)
  })

  it('does not print a card for an unnamed plus-one', () => {
    const cards = buildPlaceCards(
      [guest({ id: 'a', name: 'Anna', plusOneAllowed: true, plusOneName: null, tableNumber: 1 })],
      tables,
    )
    expect(cards).toHaveLength(1)
  })

  it('excludes declined guests, matching the printed board', () => {
    const cards = buildPlaceCards(
      [guest({ id: 'a', name: 'Gone Away', rsvpStatus: 'DECLINING', tableNumber: 1 })],
      tables,
    )
    expect(cards).toHaveLength(0)
  })

  it('excludes guests with no table and guests with a stale table number', () => {
    const cards = buildPlaceCards(
      [
        guest({ id: 'a', name: 'No Seat', tableNumber: null }),
        guest({ id: 'b', name: 'Stale Seat', tableNumber: 9 }),
      ],
      tables,
    )
    expect(cards).toHaveLength(0)
  })

  it('includes a seated guest who has not replied yet', () => {
    const cards = buildPlaceCards(
      [guest({ id: 'a', name: 'Maybe Coming', rsvpStatus: 'PENDING', tableNumber: 1 })],
      tables,
    )
    expect(cards.map(c => c.name)).toEqual(['Maybe Coming'])
  })
})

describe('sortPlaceCards', () => {
  const cards = buildPlaceCards(
    [
      guest({ id: 'a', name: 'Zoe Adams', tableNumber: 2 }),
      guest({ id: 'b', name: 'Carl Baker', tableNumber: 1 }),
      guest({ id: 'c', name: 'Amy Zimmer', tableNumber: 1 }),
    ],
    tables,
  )

  it('orders by last name for the escort card table', () => {
    expect(sortPlaceCards(cards, 'name').map(c => c.name)).toEqual([
      'Zoe Adams',
      'Carl Baker',
      'Amy Zimmer',
    ])
  })

  it('orders by table, then last name, for setting cards at each place', () => {
    expect(sortPlaceCards(cards, 'table').map(c => [c.tableLabel, c.name])).toEqual([
      ['Head Table', 'Carl Baker'],
      ['Head Table', 'Amy Zimmer'],
      ['Table 2', 'Zoe Adams'],
    ])
  })

  it('does not mutate the input array', () => {
    const original = cards.map(c => c.name)
    sortPlaceCards(cards, 'table')
    expect(cards.map(c => c.name)).toEqual(original)
  })
})
