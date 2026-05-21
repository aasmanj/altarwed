-- Add party support to guests.
-- party_id: shared UUID for guests in the same party. NULL for solo guests.
-- party_name: display name for the group (e.g. "The Smith Family"). NULL for solo guests.
-- party_contact: exactly one guest per party is the contact who receives the invite email.
--
-- WHY the GO separator is required:
-- SQL Server resolves all column references at parse time within a batch/transaction.
-- If ALTER TABLE (adds party_id) and CREATE INDEX (references party_id in WHERE clause)
-- are in the same batch, SQL Server's parser evaluates the CREATE INDEX before the ALTER
-- TABLE executes, sees party_id does not yet exist, and throws error 207.
-- GO tells Flyway to submit the preceding statements as a complete batch, commit them,
-- and then submit the next batch fresh -- so the index sees the new column.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'guests' AND COLUMN_NAME = 'party_id'
)
BEGIN
    ALTER TABLE guests
        ADD party_id      UNIQUEIDENTIFIER NULL,
            party_name    NVARCHAR(100)    NULL,
            party_contact BIT              NOT NULL CONSTRAINT DF_guests_party_contact DEFAULT 0;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_guests_party_id' AND object_id = OBJECT_ID('guests')
)
BEGIN
    CREATE INDEX IX_guests_party_id ON guests (party_id) WHERE party_id IS NOT NULL;
END
