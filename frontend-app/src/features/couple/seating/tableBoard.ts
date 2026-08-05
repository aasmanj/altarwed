import type { Guest } from '@/features/couple/guests/useGuests'
import type { SeatingTable } from './useSeatingTables'
import { isSeated, lastNameKey } from './seatingGroups'

// ─────────────────────────────────────────────────────────────────────────────
// By-table seating groups (issue #556)
//
// The physical artifact grouped BY TABLE rather than by guest: either one large
// sign (24x36in) listing every table with its seated guests, or one small card
// per table (5x7in / 6x9in) set on the table itself. Both artifacts, plus the
// "Tables at a Glance" cross-check on SeatingBoardPage, render from this one
// derivation so no two by-table views can ever disagree, and all of them agree
// with the alphabetical "Find Your Seat" board's exclusions:
//   - a declined guest is never listed (they are not coming)
//   - a guest with no valid table is never listed (they have no table to be on)
//   - a named plus-one gets their own line (they walk in as a person)
//   - a table with nobody seated is omitted (an empty sign helps no one)
//
// Pure functions, no React, so the derivation is unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export interface TableGroup {
  /** Stable React key: the table's id. */
  key: string
  /** 1-based table number; groups are returned in this order. */
  tableNumber: number
  /** The table name exactly as the couple named it. */
  tableLabel: string
  /** Everyone seated at the table, sorted by last name. Plus-ones are their own entry. */
  names: string[]
}

/**
 * Group attending, seated people (guests + named plus-ones) under their table.
 * Tables with nobody seated are omitted. Groups come back in table order, names
 * within a group in last-name order, so the printed output is deterministic.
 */
export function buildTableGroups(guests: Guest[], tables: SeatingTable[]): TableGroup[] {
  interface Entry {
    display: string
    sortKey: string
  }
  const entriesByTable = new Map<number, Entry[]>()

  for (const g of guests) {
    if (g.rsvpStatus === 'DECLINING') continue
    const tableNumber = g.tableNumber
    // isSeated owns the "stale table number after a delete" rule; the null check
    // is repeated only so TypeScript narrows tableNumber for the map key.
    if (tableNumber == null || !isSeated(g, tables.length)) continue

    let entries = entriesByTable.get(tableNumber)
    if (!entries) {
      entries = []
      entriesByTable.set(tableNumber, entries)
    }
    entries.push({ display: g.name, sortKey: lastNameKey(g.name) })
    if (g.plusOneName) {
      entries.push({ display: g.plusOneName, sortKey: lastNameKey(g.plusOneName) })
    }
  }

  const groups: TableGroup[] = []
  for (const [tableNumber, entries] of entriesByTable) {
    const table = tables[tableNumber - 1]
    entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.display.localeCompare(b.display))
    groups.push({
      key: table.id,
      tableNumber,
      tableLabel: table.name,
      names: entries.map(e => e.display),
    })
  }
  groups.sort((a, b) => a.tableNumber - b.tableNumber)
  return groups
}
