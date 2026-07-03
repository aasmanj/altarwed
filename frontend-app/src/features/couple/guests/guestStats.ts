import type { Guest } from './useGuests'

export interface GuestStats {
  // Headcount view (what caterers and the venue need): guest records plus confirmed,
  // named plus-ones. "attending"/"total" here are headcounts, so they can exceed the
  // record counts by the number of named, attending plus-ones.
  confirmedPlusOnes: number
  attending: number
  total: number
  // Response-funnel view, by guest record (NOT headcount). A plus-one doesn't independently
  // RSVP, it rides on the host guest's single decision, so counting it here would double-count
  // one choice. Every guest is in exactly one rsvpStatus, so these three sum to guests.length.
  attendingRecords: number
  declining: number
  pending: number
  respondedRecords: number
  // Denominator is "guests who could have replied": those we invited, OR who already replied
  // (a guest can RSVP via find-by-name with no emailed invite). This keeps the rate in 0-100
  // and meaningful before everyone has been invited, unlike dividing by the full headcount.
  invitedCount: number
  notYetInvited: number
  respondable: number
  responseRate: number
}

// Single source of truth for guest RSVP arithmetic, shared by the Guest List page's stat
// tiles/analytics panel and the Dashboard's At a Glance card. The two used to compute this
// independently and silently drifted apart (issue: dashboard RSVP count didn't match the
// guest list tile) -- keep every consumer on this function instead of re-deriving it.
export function computeGuestStats(guests: Guest[]): GuestStats {
  const confirmedPlusOnes = guests.filter(g => g.plusOneAllowed && g.plusOneName).length
  const plusOneAttending  = guests.filter(g => g.rsvpStatus === 'ATTENDING' && g.plusOneAllowed && g.plusOneName).length
  const attendingRecords  = guests.filter(g => g.rsvpStatus === 'ATTENDING').length
  const declining         = guests.filter(g => g.rsvpStatus === 'DECLINING').length
  const pending           = guests.filter(g => g.rsvpStatus === 'PENDING').length

  const total     = guests.length + confirmedPlusOnes
  const attending = attendingRecords + plusOneAttending

  const respondedRecords = attendingRecords + declining
  const invitedCount      = guests.filter(g => g.inviteSentAt).length
  const notYetInvited     = guests.length - invitedCount
  const respondable       = guests.filter(g => g.inviteSentAt || g.rsvpStatus !== 'PENDING').length
  const responseRate      = respondable > 0 ? Math.round((respondedRecords / respondable) * 100) : 0

  return {
    confirmedPlusOnes, attending, total,
    attendingRecords, declining, pending, respondedRecords,
    invitedCount, notYetInvited, respondable, responseRate,
  }
}
