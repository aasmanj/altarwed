-- Expand mail_state from NCHAR(2) to support international provinces/regions (e.g. "Ontario"),
-- and add mail_country for routing international Lob postcards (Canada, Mexico, Italy, etc.).
--
-- V34 created mail_state with a named CHECK constraint (mail_state = UPPER(mail_state)).
-- SQL Server refuses to ALTER a column's type while any object depends on it (error 4922:
-- "one or more objects access this column"), so the constraint MUST be dropped first.
-- We intentionally do NOT re-add an uppercase constraint: international provinces such as
-- "Ontario" or "Nuevo Leon" are mixed-case, so the old US-only rule no longer applies.
ALTER TABLE guests DROP CONSTRAINT IF EXISTS chk_guests_mail_state;
ALTER TABLE guests ALTER COLUMN mail_state NVARCHAR(100) NULL;
ALTER TABLE guests ADD mail_country NVARCHAR(100) NULL;
