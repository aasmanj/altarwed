-- V92: persist the reception table silhouette (ROUND / RECTANGLE / HEAD) a couple picks in the
-- seating editor. Before this the choice lived only on a @Transient field, so it vanished on the
-- next read/reload. Persisting it on seating_tables makes the pick durable across sessions.
--
-- NOT NULL with DEFAULT 'ROUND' (SeatingTable.DEFAULT_SHAPE): every table created before this
-- predates the choice, so the default backfills existing rows to the classic round banquet table,
-- and new inserts that omit shape fall back to the same value.
--
-- Inline CHECK constraint (single statement) per the SQL Server + Flyway rule in backend/CLAUDE.md:
-- adding the column and a separate ADD CONSTRAINT in the same transaction fails name resolution at
-- parse time, so the constraint is declared inline with the ADD.
ALTER TABLE seating_tables ADD shape NVARCHAR(20) NOT NULL DEFAULT 'ROUND'
    CONSTRAINT chk_seating_tables_shape
    CHECK (shape IN ('ROUND', 'RECTANGLE', 'HEAD'));
