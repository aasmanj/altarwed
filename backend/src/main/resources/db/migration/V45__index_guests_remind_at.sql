-- V45: Filtered index to serve RsvpReminderService.findDueReminders, the hourly poll:
--   WHERE remind_at IS NOT NULL AND remind_at <= :asOf AND rsvp_status = 'PENDING'
--
-- Filtered on (remind_at IS NOT NULL) so the index holds only guests who actually
-- requested a reminder, not one row per guest. At millions of guest rows (nearly all
-- with remind_at NULL) an unfiltered index would waste space and add write cost on
-- every guest insert/update. The INCLUDE covers rsvp_status so the poll can be
-- satisfied from the index without a key lookup back to the table.
CREATE INDEX ix_guests_remind_at
    ON guests (remind_at)
    INCLUDE (rsvp_status)
    WHERE remind_at IS NOT NULL;
