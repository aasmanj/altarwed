-- V66: track when a save-the-date email was last sent to each guest, so the
-- dashboard can show the couple who has and hasn't been emailed (mirrors the
-- existing invite_sent_at column for RSVP invitations). Null = never sent.

ALTER TABLE guests ADD save_the_date_sent_at DATETIME2 NULL;
