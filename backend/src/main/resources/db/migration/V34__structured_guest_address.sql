-- Replace the single freeform mail_address column with four structured fields.
-- SQL Server inline constraint syntax is used per CLAUDE.md to avoid the
-- "add column then add constraint in same transaction" parse failure.

ALTER TABLE guests
    DROP COLUMN mail_address;

ALTER TABLE guests
    ADD mail_line1 NVARCHAR(200) NULL;

ALTER TABLE guests
    ADD mail_city NVARCHAR(100) NULL;

-- NCHAR(2) because US state abbreviations are always exactly 2 chars.
-- CHECK added inline to avoid the same-tx column-not-visible parser bug.
ALTER TABLE guests
    ADD mail_state NCHAR(2) NULL
        CONSTRAINT chk_guests_mail_state CHECK (mail_state = UPPER(mail_state));

-- 10 chars covers ZIP (5) and ZIP+4 (10).
ALTER TABLE guests
    ADD mail_zip NVARCHAR(10) NULL
        CONSTRAINT chk_guests_mail_zip CHECK (mail_zip LIKE '[0-9][0-9][0-9][0-9][0-9]'
                                           OR mail_zip LIKE '[0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]');
