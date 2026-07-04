-- V87: Extend ix_guests_remind_at to also cover invite_send_count (issue #233).
--
-- RsvpReminderService.findDueReminders now filters out guests already at the invite-send cap:
--   WHERE remind_at IS NOT NULL AND remind_at <= :asOf
--     AND rsvp_status = 'PENDING' AND invite_send_count < :maxInviteSends
-- The V45 filtered index (WHERE remind_at IS NOT NULL) already narrows to the handful of guests
-- who requested a reminder, but did not carry invite_send_count, forcing a key lookup back to the
-- base table for the new cap predicate. Adding invite_send_count to the INCLUDE list keeps the
-- hourly poll fully covered by the index (no key lookup), consistent with V45's coverage design.
--
-- The index is still FILTERED on (remind_at IS NOT NULL) so it holds only reminder rows, not one
-- row per guest, keeping it tiny and cheap to maintain on every guest insert/update.
DROP INDEX ix_guests_remind_at ON guests;

CREATE INDEX ix_guests_remind_at
    ON guests (remind_at)
    INCLUDE (rsvp_status, invite_send_count)
    WHERE remind_at IS NOT NULL;
