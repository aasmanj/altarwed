-- V101: date-offset RSVP campaign reminder markers (issue #458).
--
-- Two nullable per-guest timestamps so the hourly CampaignReminderService sends each guest at
-- most one email per campaign window and never re-sends after a restart or on the next poll:
--   nonresponder_reminder_sent_at -- stamped when the ~30-day "you have not RSVP'd yet" reminder
--                                    is queued for a still-PENDING guest.
--   attending_reminder_sent_at    -- stamped when the ~7-day venue-details reminder is queued
--                                    for an ATTENDING guest.
-- Both null = that reminder has not been sent yet; the reminder queries filter on IS NULL.
--
-- Additive and nullable, so every existing guest row is unaffected (both start null). Type is
-- DATETIMEOFFSET (not DATETIME2) to match the SQL Server convention for new timestamp columns;
-- it maps to OffsetDateTime on GuestEntity via @Column(columnDefinition = "DATETIMEOFFSET").
ALTER TABLE guests ADD
    nonresponder_reminder_sent_at DATETIMEOFFSET NULL,
    attending_reminder_sent_at DATETIMEOFFSET NULL;
