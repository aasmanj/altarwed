import type { Guest, GuestSide, RsvpStatus, UpdateGuestPayload } from './useGuests'

// Builds the save plan for the inline guest Edit row (issue #305).
//
// Why two requests: the general guest PATCH uses null-means-not-provided merge
// semantics (GuestService.updateGuest), so it can set tableNumber but can never
// clear it; axios also drops undefined from the JSON body, so "send undefined"
// is a no-op, not a clear. The backend already has a dedicated
// PUT /guests/couple/{coupleId}/{guestId}/table (useAssignGuestTable) whose null
// unambiguously means "remove from table". So the edit row routes ALL table
// changes through that PUT and never puts tableNumber on the PATCH payload:
// one endpoint owns seating, and clearing works end to end.
//
// Side, documented decision: Side has no dedicated clear endpoint, and changing
// the PATCH merge semantics is out of scope for #305 (null-means-not-provided
// protects every other field). Clearing Side is therefore NOT supported; the
// edit row hides the blank option once a side is set, so the UI never offers a
// clear it cannot persist, and stripUndefined in useUpdateGuest.onMutate keeps
// the optimistic cache from pretending otherwise.

export interface GuestEditForm {
  name: string
  email: string
  phone: string
  side: GuestSide | ''
  party: string
  status: RsvpStatus
  table: string
  plusOne: boolean
  song: string
  mailLine1: string
  mailCity: string
  mailState: string
  mailZip: string
  mailCountry: string
}

export interface GuestSavePlan {
  // Body for the general PATCH. Never contains tableNumber (see module comment).
  patchPayload: UpdateGuestPayload
  // Seating change for the dedicated PUT: a number assigns, null unassigns,
  // and undefined (key absent) means the table did not change, skip the PUT.
  tableNumber?: number | null
}

export function buildGuestSavePlan(
  guest: Pick<Guest, 'tableNumber'>,
  form: GuestEditForm,
): GuestSavePlan {
  const plan: GuestSavePlan = {
    patchPayload: {
      name: form.name,
      email: form.email,
      phone: form.phone,
      side: form.side || undefined,
      partyName: form.party,
      rsvpStatus: form.status,
      plusOneAllowed: form.plusOne,
      songRequest: form.song,
      mailLine1: form.mailLine1,
      mailCity: form.mailCity,
      mailState: form.mailState,
      mailZip: form.mailZip,
      mailCountry: form.mailCountry,
    },
  }

  const trimmed = form.table.trim()
  const parsed = trimmed === '' ? null : parseInt(trimmed, 10)
  // NaN (unparseable input past the number field) is treated as "no change":
  // the old PATCH path serialized NaN as null, which the merge ignored too.
  if (parsed !== null && Number.isNaN(parsed)) return plan
  if (parsed !== guest.tableNumber) plan.tableNumber = parsed
  return plan
}
