import type { Guest } from '@/features/couple/guests/useGuests'
import type { SeatingTable } from './useSeatingTables'
import { lastNameKey } from './seatingGroups'

// ─────────────────────────────────────────────────────────────────────────────
// Escort / place cards (issue #556)
//
// The second physical artifact of the reception. The seating board is one big
// sign; escort cards are one small card per person, laid out at the entrance so a
// guest picks up their own name and reads which table to walk to. Couples buy
// pre-scored card stock and need a cut-apart grid, which is why this is a print
// sheet and not a screen view.
//
// The card set is derived from exactly the same data the board is derived from,
// with the same two exclusions, so the two artifacts can never disagree:
//   - a guest with no valid table has no card (they have nowhere to be sent)
//   - a declined guest has no card (they are not coming)
// A named plus-one gets their own card, because a plus-one walks in as a person,
// not as a suffix on someone else's card.
//
// Pure functions, no React, so the derivation is unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceCard {
  /** Stable React key. Guest id, suffixed for the plus-one's card. */
  key: string
  /** The name printed large on the card. */
  name: string
  /** The table name printed under it, exactly as the couple named the table. */
  tableLabel: string
  /** 1-based table number, used for the "by table" ordering. */
  tableNumber: number
  /** Alphabetical sort key (last name), shared with the seating board. */
  sortKey: string
}

export type PlaceCardOrder = 'name' | 'table'

/**
 * Build one card per attending, seated person (guest + any named plus-one).
 * Returned in a deterministic order; use sortPlaceCards to pick the layout order.
 */
export function buildPlaceCards(guests: Guest[], tables: SeatingTable[]): PlaceCard[] {
  const cards: PlaceCard[] = []

  for (const g of guests) {
    if (g.rsvpStatus === 'DECLINING') continue
    const tableNumber = g.tableNumber
    if (tableNumber == null) continue
    const table = tables[tableNumber - 1]
    if (!table) continue

    cards.push({
      key: g.id,
      name: g.name,
      tableLabel: table.name,
      tableNumber,
      sortKey: lastNameKey(g.name),
    })
    if (g.plusOneName) {
      cards.push({
        key: `${g.id}-plus-one`,
        name: g.plusOneName,
        tableLabel: table.name,
        tableNumber,
        sortKey: lastNameKey(g.plusOneName),
      })
    }
  }

  return cards
}

/**
 * Two useful stacking orders for the same cards:
 *   'name'  alphabetical by last name, for laying the cards out on an escort table
 *           where guests hunt for their own name.
 *   'table' grouped by table, for walking the cards to each table as place cards.
 * Both fall back to the display name so the order is total and stable.
 */
export function sortPlaceCards(cards: PlaceCard[], order: PlaceCardOrder): PlaceCard[] {
  const sorted = [...cards]
  if (order === 'table') {
    sorted.sort((a, b) =>
      a.tableNumber - b.tableNumber ||
      a.sortKey.localeCompare(b.sortKey) ||
      a.name.localeCompare(b.name),
    )
  } else {
    sorted.sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey) ||
      a.name.localeCompare(b.name),
    )
  }
  return sorted
}
