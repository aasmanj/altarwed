// RSVP data fetch + error classification for the guest-facing RSVP page.
//
// Extracted from page.tsx so the failure-mode branching can be unit tested with
// a mocked fetch (issue #147). The important distinction is between a genuinely
// dead token (400/404) and a transient backend problem (5xx, network, timeout,
// malformed body). Collapsing both into a single "link expired" message told
// real guests their valid invite was dead during a cold start or brief hiccup,
// on the platform's core conversion surface.

export const API =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

export interface PartyMemberInfo {
  guestId: string
  name: string
  currentRsvpStatus: string | null
  currentDietary: string | null
  currentSongRequest: string | null
}

export interface CustomQuestion {
  id: string
  questionText: string
  type: 'TEXT' | 'YES_NO' | 'CHOICE'
  options: string[]
  required: boolean
}

export interface RsvpPageData {
  guestName: string
  coupleNames: string
  weddingDate: string | null
  // Raw ISO date (yyyy-MM-dd) + free-form ceremony time + full street address, all added
  // for the "add to calendar" .ics builder on the confirmation screen (issue #330). The
  // formatted `weddingDate` display string above is unchanged.
  weddingDateIso: string | null
  ceremonyTime: string | null
  venueName: string | null
  venueAddress: string | null
  venueCity: string | null
  venueState: string | null
  plusOneAllowed: boolean
  weddingSlug: string | null
  hasRegistry: boolean
  partyMembers: PartyMemberInfo[] | null
  partyName: string | null
  currentRsvpStatus: string | null
  currentPlusOneName: string | null
  currentDietary: string | null
  currentSongRequest: string | null
  currentNoteForCouple: string | null
  customQuestions: CustomQuestion[] | null
}

// Discriminated union so callers must handle each failure class explicitly:
//   ok          -> render the RSVP form
//   invalid     -> the token is genuinely bad/expired (terminal, contact couple)
//   unavailable -> a transient backend problem, tell the guest to try again
export type RsvpFetchResult =
  | { status: 'ok'; data: RsvpPageData }
  | { status: 'invalid' }
  | { status: 'unavailable' }

export async function getRsvpData(token: string): Promise<RsvpFetchResult> {
  try {
    const res = await fetch(`${API}/api/v1/guests/rsvp/${token}`, { cache: 'no-store' })
    // Only a 400/404 means the token itself is invalid or expired.
    if (res.status === 400 || res.status === 404) return { status: 'invalid' }
    // Any other non-2xx (5xx, 429, etc.) is a backend problem, not a dead link.
    if (!res.ok) return { status: 'unavailable' }
    const data = (await res.json()) as RsvpPageData
    return { status: 'ok', data }
  } catch {
    // Network failure, timeout, or malformed body: transient, not a dead link.
    return { status: 'unavailable' }
  }
}
