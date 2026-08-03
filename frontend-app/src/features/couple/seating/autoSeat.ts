import type { Guest } from '@/features/couple/guests/useGuests'
import type { SeatingTable } from './useSeatingTables'
import { guestSeats, isSeated } from './seatingGroups'

// ─────────────────────────────────────────────────────────────────────────────
// Auto-seat by household (issue #556)
//
// Seating an 80-guest list one guest at a time is the "my sister spent a week on
// this" failure. This module turns the first pass into a single click: fill the
// tables the couple already created with the households that are actually coming,
// then let them tweak the ~10 placements that matter instead of making all ~80.
//
// It is a greedy first-fit-decreasing bin packing heuristic: sort households
// largest-first, drop each into the first table with room. First-fit-decreasing is
// the classic bin-packing approximation (provably within 11/9 of optimal bin count)
// and, crucially for a "run it again and get the same board" promise, it is
// deterministic: no randomness, and every tie is broken on a stable key.
//
// Design constraints that come from the product, not the algorithm:
//   - Never split a household. A family that does not fit anywhere is left in the
//     pool for a human decision rather than scattered across two tables.
//   - Never move a guest who is already seated. Auto-seat is purely additive, which
//     is what makes "clear all seats" a real inverse and the whole action safe to
//     try.
//   - Only attending guests are placed. Declined and unreplied guests stay out of
//     the pool (same rule the printed board uses).
//
// Everything here is pure so it is unit-testable without React and without the API.
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoSeatAssignment {
  guestId: string
  // 1-based positional table number, matching the tableNumber contract used
  // everywhere else in seating (index into the tables array + 1).
  tableNumber: number
}

export interface UnplacedHousehold {
  label: string
  seats: number
}

export interface AutoSeatPlan {
  assignments: AutoSeatAssignment[]
  /** Guest records that would be newly seated. */
  seatedGuests: number
  /** Seats those records consume, counting named plus-ones. */
  seatedSeats: number
  /** Distinct tables that receive at least one new guest. */
  tablesUsed: number
  /** Households left in the pool because no single table had room for all of them. */
  unplaced: UnplacedHousehold[]
}

interface Household {
  label: string
  members: Guest[]
  seats: number
  /** Stable tie-break key so equal-sized households always sort the same way. */
  firstId: string
}

const EMPTY_PLAN: AutoSeatPlan = {
  assignments: [],
  seatedGuests: 0,
  seatedSeats: 0,
  tablesUsed: 0,
  unplaced: [],
}

// Group the auto-seatable pool into households. A guest with no partyId is their
// own one-person household, which keeps the packing loop uniform.
function buildHouseholds(pool: Guest[]): Household[] {
  const byParty = new Map<string, Guest[]>()
  const households: Household[] = []

  for (const g of pool) {
    if (g.partyId) {
      const arr = byParty.get(g.partyId)
      if (arr) arr.push(g)
      else byParty.set(g.partyId, [g])
    } else {
      households.push({
        label: g.name,
        members: [g],
        seats: guestSeats(g),
        firstId: g.id,
      })
    }
  }

  for (const members of byParty.values()) {
    households.push({
      label: members[0].partyName?.trim() || 'Household',
      members,
      seats: members.reduce((sum, g) => sum + guestSeats(g), 0),
      firstId: members.reduce((min, g) => (g.id < min ? g.id : min), members[0].id),
    })
  }

  // Largest first (the "decreasing" in first-fit-decreasing), then a total order on
  // label and id so the same input always produces byte-identical output.
  households.sort((a, b) =>
    b.seats - a.seats ||
    a.label.localeCompare(b.label) ||
    a.firstId.localeCompare(b.firstId),
  )
  return households
}

/**
 * Plan a full auto-seat pass. Pure: returns the assignments to apply, it does not
 * apply them. Callers feed the result to the existing per-guest assign mutation.
 */
export function planAutoSeat(guests: Guest[], tables: SeatingTable[]): AutoSeatPlan {
  if (tables.length === 0) return EMPTY_PLAN

  // Seats already taken per table. Every seated guest counts, including declined or
  // unreplied ones still sitting on the chart: auto-seat must not double-book a
  // chair the couple can still see occupied in the editor.
  const occupied = new Array<number>(tables.length).fill(0)
  for (const g of guests) {
    const tn = g.tableNumber
    if (tn != null && isSeated(g, tables.length)) occupied[tn - 1] += guestSeats(g)
  }

  // Parties that already have a seated anchor: the unseated remainder must join
  // that same table, never be split to wherever first-fit lands them.
  const anchorByParty = new Map<string, number>()
  for (const g of guests) {
    if (g.partyId && isSeated(g, tables.length)) {
      anchorByParty.set(g.partyId, g.tableNumber!)
    }
  }

  const pool = guests.filter(g => g.rsvpStatus === 'ATTENDING' && !isSeated(g, tables.length))
  if (pool.length === 0) return EMPTY_PLAN

  const assignments: AutoSeatAssignment[] = []
  const unplaced: UnplacedHousehold[] = []
  const touched = new Set<number>()
  let seatedGuests = 0
  let seatedSeats = 0

  for (const household of buildHouseholds(pool)) {
    // All members of a pool household share the same partyId (or none).
    const anchorTable = household.members[0].partyId
      ? anchorByParty.get(household.members[0].partyId)
      : undefined

    let tableIdx: number
    if (anchorTable != null) {
      // Honour the anchor: only seat at the table where their family already sits.
      // If that table has no room, leave the household for a human decision rather
      // than splitting them across two tables.
      const idx = anchorTable - 1
      if (tables[idx] && tables[idx].capacity - occupied[idx] >= household.seats) {
        tableIdx = idx
      } else {
        unplaced.push({ label: household.label, seats: household.seats })
        continue
      }
    } else {
      tableIdx = tables.findIndex((t, i) => t.capacity - occupied[i] >= household.seats)
      if (tableIdx === -1) {
        unplaced.push({ label: household.label, seats: household.seats })
        continue
      }
    }

    occupied[tableIdx] += household.seats
    touched.add(tableIdx)
    seatedGuests += household.members.length
    seatedSeats += household.seats
    for (const g of household.members) {
      assignments.push({ guestId: g.id, tableNumber: tableIdx + 1 })
    }
  }

  return { assignments, seatedGuests, seatedSeats, tablesUsed: touched.size, unplaced }
}

/**
 * The inverse of auto-seat: every guest currently sitting at a real table. Used by
 * "Clear all seats" so one action undoes a whole auto-seat pass.
 */
export function seatedGuestIds(guests: Guest[], tableCount: number): string[] {
  return guests.filter(g => isSeated(g, tableCount)).map(g => g.id)
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Human summary of what an auto-seat pass actually did, for the success toast. */
export function autoSeatSummary(seatedGuests: number, tablesUsed: number, unplaced: number): string {
  const base = `Seated ${plural(seatedGuests, 'guest', 'guests')} across ${plural(tablesUsed, 'table', 'tables')}.`
  if (unplaced === 0) return base
  return `${base} ${plural(unplaced, 'household', 'households')} did not fit, add a table or more seats.`
}
