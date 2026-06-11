-- International postal codes (Canada "T1A 0W3", UK "SW1A 1AA") do not match the V34
-- US-only format CHECK, and NVARCHAR(10) is too narrow for messy imported values.
-- V63 internationalized mail_state and added mail_country but missed mail_zip; a synced
-- Canadian postal code failed the column width in prod (SQL error 2628) and aborted the
-- entire sheet sync. Same drop-then-alter pattern as V63: the constraint must be dropped
-- before ALTER COLUMN (SQL Server error 4922 otherwise).
ALTER TABLE guests DROP CONSTRAINT IF EXISTS chk_guests_mail_zip;
ALTER TABLE guests ALTER COLUMN mail_zip NVARCHAR(20) NULL;
