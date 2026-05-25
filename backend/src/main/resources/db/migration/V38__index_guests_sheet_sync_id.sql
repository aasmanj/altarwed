-- Partial index on sheet_sync_id: only indexes rows that have a UUID stamped.
-- Must be a separate migration from V37 because SQL Server compiles the entire
-- Flyway transaction before executing -- a CREATE INDEX referencing a column
-- added in the same transaction fails at parse time with "invalid column name".
CREATE INDEX ix_guests_sheet_sync_id
    ON guests (couple_id, sheet_sync_id)
    WHERE sheet_sync_id IS NOT NULL;
