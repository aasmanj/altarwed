-- V27: RSVP reminder — let undecided guests request a follow-up invite.
-- remind_at: when set, a @Scheduled job re-sends the RSVP invite and clears this field.
-- Replaces the MAYBE rsvp_status for guests who haven't decided yet.

ALTER TABLE guests ADD remind_at DATETIME2 NULL;
