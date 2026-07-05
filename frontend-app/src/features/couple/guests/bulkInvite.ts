import type { Guest, BulkInviteResult, BulkInviteSkipReason } from './useGuests'

// Mirror of the backend cap (GuestService.MAX_INVITE_SENDS). A guest at or over this
// count is not offered as a recipient; the backend also enforces it and reports a skip.
export const MAX_INVITE_SENDS = 3

// Friendly copy for each skip reason the backend can return, used to build the result
// toast (for example "Skipped 3: 2 already responded, 1 no email address").
export const SKIP_REASON_LABEL: Record<BulkInviteSkipReason, string> = {
  no_email: 'no email address',
  already_responded: 'already responded',
  cap_reached: 'reached the 3-invite limit',
  unsubscribed: 'unsubscribed',
}

// Guests an RSVP invite can actually reach: pending, has an email, not unsubscribed,
// and under the send cap. The picker only offers these; the backend independently
// applies (and reports) the same rules so a stale selection is always safe.
export function invitableGuests(guests: Guest[]): Guest[] {
  return guests.filter(
    g =>
      g.rsvpStatus === 'PENDING' &&
      !!g.email &&
      !g.emailUnsubscribed &&
      (g.inviteSendCount ?? 0) < MAX_INVITE_SENDS,
  )
}

// Default recipients: invitable guests who have not been invited yet, so re-running the
// bulk send does not resend to guests who already received an invite.
export function unsentInvitableIds(guests: Guest[]): string[] {
  return invitableGuests(guests)
    .filter(g => !g.inviteSentAt)
    .map(g => g.id)
}

// Human summary of what a bulk send actually did, grouped by reason so the couple sees
// "Sent 12 RSVP invites. Skipped 3: 2 already responded, 1 no email address." rather
// than a bare count.
export function summariseInviteResult(result: BulkInviteResult): string {
  const sentPart = `Sent ${result.sent} RSVP invite${result.sent === 1 ? '' : 's'}.`
  if (result.skipped === 0) return sentPart
  const counts = new Map<BulkInviteSkipReason, number>()
  for (const s of result.skippedGuests) {
    counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1)
  }
  const breakdown = [...counts.entries()]
    .map(([reason, n]) => `${n} ${SKIP_REASON_LABEL[reason]}`)
    .join(', ')
  return `${sentPart} Skipped ${result.skipped}: ${breakdown}.`
}
