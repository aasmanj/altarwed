import type { Guest, RsvpStatus } from '@/features/couple/guests/useGuests'

// ─────────────────────────────────────────────────────────────────────────────
// Pure seating helpers
//
// The seating editor used to treat every guest as an isolated record: a flat
// unassigned pool, one-person-at-a-time assignment, no RSVP context. Real guest
// lists are households (parties from issue #252), so seating an 80-guest / 25-
// household list one click at a time is the "week not an evening" failure this
// module fixes. Everything here is a pure function so it is unit-testable without
// rendering React, and so the counts on the page and the printed board stay in
// sync (they call the same helpers).
// ─────────────────────────────────────────────────────────────────────────────

// Alphabetical key for a person: the last whitespace-separated token of their
// name, lowercased. Falls back to the whole name for single-word entries. Shared
// by the printed board and the escort cards so both sort people identically.
export function lastNameKey(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[parts.length - 1] || name).toLowerCase()
}

// Seats a single guest record needs: the guest plus a named plus-one. A plus-one
// with no name yet is not a real head, so it does not reserve a seat (matches how
// the printed board only emits a row per *named* plus-one).
export function guestSeats(g: Guest): number {
  return 1 + (g.plusOneName ? 1 : 0)
}

// Household seat totals keyed by partyId, computed across the *whole* guest list
// (seated or not) so a chip can show its household size even when some members
// are already at a table.
export function partyHeadcountById(guests: Guest[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const g of guests) {
    if (!g.partyId) continue
    map.set(g.partyId, (map.get(g.partyId) ?? 0) + guestSeats(g))
  }
  return map
}

export interface PartyGroup {
  partyId: string
  partyName: string
  guests: Guest[]
  // Seats this group's unassigned members need (sum of guestSeats).
  headcount: number
}

export interface GroupedUnassigned {
  parties: PartyGroup[]
  individuals: Guest[]
}

// Split the unassigned pool into household groups and lone individuals. A party
// only earns its own group (and a "seat all" action) when 2+ of its members are
// still unassigned; a household with a single unassigned member left offers no
// batching win, so that member drops into Individuals where drag-drop and tap-to-
// assign keep working exactly as before.
export function groupUnassignedByParty(unassigned: Guest[]): GroupedUnassigned {
  const byParty = new Map<string, Guest[]>()
  const individuals: Guest[] = []

  for (const g of unassigned) {
    if (g.partyId) {
      const arr = byParty.get(g.partyId)
      if (arr) arr.push(g)
      else byParty.set(g.partyId, [g])
    } else {
      individuals.push(g)
    }
  }

  const parties: PartyGroup[] = []
  for (const [partyId, members] of byParty) {
    if (members.length >= 2) {
      parties.push({
        partyId,
        partyName: members[0].partyName?.trim() || 'Household',
        guests: members,
        headcount: members.reduce((sum, g) => sum + guestSeats(g), 0),
      })
    } else {
      individuals.push(...members)
    }
  }

  parties.sort((a, b) => a.partyName.localeCompare(b.partyName))
  individuals.sort((a, b) => a.name.localeCompare(b.name))
  return { parties, individuals }
}

// A guest is seated only when their tableNumber points at a table that still
// exists. tableNumber is 1-based and positional (index+1), so a stale number left
// over after a table delete does not count as seated (see the guests-cache
// invalidation on table delete, audit P1-3).
export function isSeated(g: Guest, tableCount: number): boolean {
  return g.tableNumber != null && g.tableNumber >= 1 && g.tableNumber <= tableCount
}

// The one number that decides whether the couple can print yet: attending guests
// who still have no real table. Declined / pending guests are intentionally
// excluded, seating them is optional.
export function countUnseatedAttending(guests: Guest[], tableCount: number): number {
  return guests.filter(g => g.rsvpStatus === 'ATTENDING' && !isSeated(g, tableCount)).length
}

// ─── RSVP status presentation ────────────────────────────────────────────────

export function rsvpStatusLabel(status: RsvpStatus): string {
  switch (status) {
    case 'ATTENDING': return 'Attending'
    case 'DECLINING': return 'Declined'
    default: return 'Awaiting reply'
  }
}

// Tailwind text color for the status icon. Color is only ever a secondary cue:
// the icon shape (check / x / hollow circle) and the accessible label carry the
// meaning, so the indicator is not color-only (WCAG 1.4.1).
export function rsvpColorClass(status: RsvpStatus): string {
  switch (status) {
    case 'ATTENDING': return 'text-emerald-600'
    case 'DECLINING': return 'text-rose-600'
    default: return 'text-stone-400'
  }
}

export interface SeatedFlag {
  label: string
  tone: 'danger' | 'muted'
}

// A badge for a seated guest who is not attending, so a declined or unreplied
// guest cannot sit silently on the chart (and then the printed board). Declined
// is the loud case; pending is a soft reminder.
export function seatedNonAttendingFlag(g: Guest, isAssigned: boolean): SeatedFlag | null {
  if (!isAssigned || g.rsvpStatus === 'ATTENDING') return null
  if (g.rsvpStatus === 'DECLINING') return { label: 'Declined', tone: 'danger' }
  return { label: 'No reply', tone: 'muted' }
}
