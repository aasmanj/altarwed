import type { Guest } from '@/features/couple/guests/useGuests'
import type { GuestStats } from '@/features/couple/guests/guestStats'

// The funnel stage a couple is on, after their site is published. Each stage is a stable
// identifier used both to pick the copy below and to key the per-stage dismissal in
// localStorage, so dismissing one stage's nudge does not hide the next one.
export type NextStepStage =
  | 'ADD_GUESTS'
  | 'SEND_SAVE_THE_DATES'
  | 'SEND_INVITES'
  | 'AWAIT_RSVPS'

export interface NextStepNudge {
  stage: NextStepStage
  // One short, warm sentence. Written for the non-technical bride: no jargon, no em dashes.
  message: string
  ctaLabel: string
  href: string
}

// Pure funnel-stage machine for the dashboard "next step" nudge. First matching rule wins,
// mirroring the couple's real progression: build the list, announce the date, invite to RSVP,
// then chase stragglers. Returns null when there is nothing left to nudge (all invited and
// everyone has responded), so the caller hides the card.
//
// Field-name and semantics notes (kept in sync with useGuests.ts / guestStats.ts on purpose):
//  - saveTheDateSentAt: ISO string once a save-the-date was attempted, else null.
//  - inviteSendCount: boxed Integer from the backend, so null means "never invited", not zero.
//    "Invites sent" therefore means (inviteSendCount ?? 0) > 0 for at least one guest.
//  - pending is taken from computeGuestStats (guests with rsvpStatus === 'PENDING') so the
//    "N have not responded" count can never contradict the RSVP tile rendered right beside it.
export function computeNextStep(guests: Guest[], stats: GuestStats): NextStepNudge | null {
  // Rule 1: published site but no one to invite yet.
  if (guests.length === 0) {
    return {
      stage: 'ADD_GUESTS',
      message: 'Start with the people you cannot imagine the day without.',
      ctaLabel: 'Add guests',
      href: '/dashboard/guests',
    }
  }

  // Rule 2: guests exist, but no save-the-date has gone out to anyone.
  const anySaveTheDateSent = guests.some(g => g.saveTheDateSentAt != null)
  if (!anySaveTheDateSent) {
    return {
      stage: 'SEND_SAVE_THE_DATES',
      message: 'Let everyone know to save your date.',
      ctaLabel: 'Send save-the-dates',
      href: '/dashboard/save-the-date',
    }
  }

  // Rule 3: save-the-dates are out, but no RSVP invite has been sent to anyone.
  const anyInviteSent = guests.some(g => (g.inviteSendCount ?? 0) > 0)
  if (!anyInviteSent) {
    return {
      stage: 'SEND_INVITES',
      message: 'Invite your guests so they can RSVP.',
      ctaLabel: 'Send invites',
      href: '/dashboard/guests',
    }
  }

  // Rule 4: invites are out and some guests still have not replied.
  if (stats.pending > 0) {
    const n = stats.pending
    return {
      stage: 'AWAIT_RSVPS',
      message: `${n} guest${n === 1 ? ' has' : 's have'} not responded yet.`,
      ctaLabel: 'View guest list',
      href: '/dashboard/guests',
    }
  }

  // Rule 5: everyone is invited and everyone has responded. Nothing to nudge.
  return null
}

// localStorage key for a dismissed nudge. Scoped to BOTH the couple id and the stage:
//  - per couple, so two couples sharing one browser never inherit each other's dismissals.
//  - per stage, so dismissing "Add guests" does not also silence "Send save-the-dates"; the
//    card reappears the moment the couple advances to the next stage.
export function dismissalStorageKey(coupleId: string, stage: NextStepStage): string {
  return `altarwed:nextstep-dismissed:${coupleId}:${stage}`
}
