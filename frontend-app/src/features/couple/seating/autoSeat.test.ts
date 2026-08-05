import { describe, it, expect } from 'vitest'
import type { Guest } from '@/features/couple/guests/useGuests'
import type { SeatingTable } from './useSeatingTables'
import { planAutoSeat, seatedGuestIds, autoSeatSummary } from './autoSeat'

// Issue #556: auto-seat by household. Before this change there was no bulk seating at
// all, so every assertion here fails on the pre-change code (the module did not exist)
// and passes after. The algorithm is the load-bearing part: it must never split a
// household, never move a seated guest, never over-fill a table, and must be
// deterministic so re-running it produces the same board.

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

function table(id: string, name: string, capacity: number): SeatingTable {
  return { id, coupleId: 'c1', name, capacity, sortOrder: 0 }
}

// Convenience: guestId -> tableNumber map for readable assertions.
function seatMap(assignments: { guestId: string; tableNumber: number }[]) {
  return Object.fromEntries(assignments.map(a => [a.guestId, a.tableNumber]))
}

describe('planAutoSeat', () => {
  it('keeps a household together at one table', () => {
    const guests = [
      guest({ id: 'a', partyId: 'p1', partyName: 'Smith' }),
      guest({ id: 'b', partyId: 'p1', partyName: 'Smith' }),
      guest({ id: 'c', partyId: 'p1', partyName: 'Smith' }),
    ]
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 8)])
    const seats = seatMap(plan.assignments)
    expect(seats).toEqual({ a: 1, b: 1, c: 1 })
    expect(plan.seatedGuests).toBe(3)
    expect(plan.tablesUsed).toBe(1)
    expect(plan.unplaced).toHaveLength(0)
  })

  it('never splits a household: an oversized one stays in the pool', () => {
    const guests = [
      guest({ id: 'a', partyId: 'p1', partyName: 'Big Family' }),
      guest({ id: 'b', partyId: 'p1', partyName: 'Big Family' }),
      guest({ id: 'c', partyId: 'p1', partyName: 'Big Family' }),
      guest({ id: 'solo', name: 'Solo Guest' }),
    ]
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 2)])
    expect(seatMap(plan.assignments)).toEqual({ solo: 1 })
    expect(plan.unplaced).toEqual([{ label: 'Big Family', seats: 3 }])
  })

  it('packs largest household first (first-fit-decreasing)', () => {
    const guests = [
      guest({ id: 's1', name: 'Solo One' }),
      guest({ id: 'b1', partyId: 'p1', partyName: 'Four' }),
      guest({ id: 'b2', partyId: 'p1', partyName: 'Four' }),
      guest({ id: 'b3', partyId: 'p1', partyName: 'Four' }),
      guest({ id: 'b4', partyId: 'p1', partyName: 'Four' }),
    ]
    // Table 1 holds exactly the four-person household; the solo guest is pushed on.
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 4), table('t2', 'Table 2', 4)])
    const seats = seatMap(plan.assignments)
    expect(seats).toEqual({ b1: 1, b2: 1, b3: 1, b4: 1, s1: 2 })
    expect(plan.tablesUsed).toBe(2)
  })

  it('respects remaining capacity of tables that are already partly filled', () => {
    const guests = [
      guest({ id: 'seated1', tableNumber: 1 }),
      guest({ id: 'seated2', tableNumber: 1 }),
      guest({ id: 'x', partyId: 'p1', partyName: 'Pair' }),
      guest({ id: 'y', partyId: 'p1', partyName: 'Pair' }),
    ]
    // Table 1 has 1 seat left, so the pair has to go to table 2.
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 3), table('t2', 'Table 2', 4)])
    expect(seatMap(plan.assignments)).toEqual({ x: 2, y: 2 })
  })

  it('counts a named plus-one as a second seat', () => {
    const guests = [guest({ id: 'a', name: 'Ann', plusOneName: 'Ben' })]
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 1)])
    expect(plan.assignments).toHaveLength(0)
    expect(plan.unplaced).toEqual([{ label: 'Ann', seats: 2 }])
  })

  it('never moves a guest who is already seated', () => {
    const guests = [
      guest({ id: 'seated', tableNumber: 2 }),
      guest({ id: 'loose' }),
    ]
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 8), table('t2', 'Table 2', 8)])
    expect(plan.assignments.map(a => a.guestId)).toEqual(['loose'])
  })

  it('seats only attending guests', () => {
    const guests = [
      guest({ id: 'yes', rsvpStatus: 'ATTENDING' }),
      guest({ id: 'no', rsvpStatus: 'DECLINING' }),
      guest({ id: 'maybe', rsvpStatus: 'PENDING' }),
    ]
    const plan = planAutoSeat(guests, [table('t1', 'Table 1', 8)])
    expect(plan.assignments.map(a => a.guestId)).toEqual(['yes'])
  })

  it('is a no-op when there are no tables', () => {
    const plan = planAutoSeat([guest({ id: 'a' })], [])
    expect(plan.assignments).toHaveLength(0)
    expect(plan.seatedGuests).toBe(0)
  })

  it('is deterministic: same input, byte-identical plan', () => {
    const guests = [
      guest({ id: 'a', partyId: 'p1', partyName: 'Alpha' }),
      guest({ id: 'b', partyId: 'p1', partyName: 'Alpha' }),
      guest({ id: 'c', partyId: 'p2', partyName: 'Beta' }),
      guest({ id: 'd', partyId: 'p2', partyName: 'Beta' }),
      guest({ id: 'e', name: 'Eve' }),
    ]
    const tables = [table('t1', 'Table 1', 4), table('t2', 'Table 2', 4)]
    const first = planAutoSeat(guests, tables)
    const second = planAutoSeat(guests, tables)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    // Equal-sized households tie-break on label, so Alpha is packed before Beta.
    // Both pairs fill table 1 exactly, pushing the lone guest onto table 2.
    expect(seatMap(first.assignments)).toEqual({ a: 1, b: 1, c: 1, d: 1, e: 2 })
  })

  it('never over-fills a table across a realistic list', () => {
    const guests: Guest[] = []
    for (let p = 0; p < 12; p++) {
      const size = (p % 4) + 1
      for (let m = 0; m < size; m++) {
        guests.push(guest({ id: `p${p}-m${m}`, partyId: `party${p}`, partyName: `House ${p}` }))
      }
    }
    const tables = [
      table('t1', 'Table 1', 8),
      table('t2', 'Table 2', 8),
      table('t3', 'Table 3', 8),
      table('t4', 'Table 4', 8),
    ]
    const plan = planAutoSeat(guests, tables)

    const perTable = new Map<number, number>()
    for (const a of plan.assignments) perTable.set(a.tableNumber, (perTable.get(a.tableNumber) ?? 0) + 1)
    for (const [tableNumber, filled] of perTable) {
      expect(filled).toBeLessThanOrEqual(tables[tableNumber - 1].capacity)
    }
    // Every assigned guest appears exactly once.
    expect(new Set(plan.assignments.map(a => a.guestId)).size).toBe(plan.assignments.length)
  })
})

describe('seatedGuestIds', () => {
  it('returns exactly the guests sitting at a table that still exists', () => {
    const guests = [
      guest({ id: 'a', tableNumber: 1 }),
      guest({ id: 'b', tableNumber: null }),
      // Stale number left over after a table was deleted: not really seated.
      guest({ id: 'c', tableNumber: 9 }),
    ]
    expect(seatedGuestIds(guests, 2)).toEqual(['a'])
  })
})

describe('autoSeatSummary', () => {
  it('reports the headline counts', () => {
    expect(autoSeatSummary(47, 6, 0)).toBe('Seated 47 guests across 6 tables.')
  })

  it('uses singular wording for one guest at one table', () => {
    expect(autoSeatSummary(1, 1, 0)).toBe('Seated 1 guest across 1 table.')
  })

  it('calls out households that did not fit', () => {
    expect(autoSeatSummary(10, 2, 1))
      .toBe('Seated 10 guests across 2 tables. 1 household did not fit, add a table or more seats.')
  })
})
