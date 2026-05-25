-- Stable identifier written back to the couple's Google Sheet so the sync
-- can match rows reliably even when the guest name or email changes over time.
-- Null for guests added manually or synced before write-back was introduced.
-- NOTE: index is in V38 -- SQL Server compiles the whole transaction before
-- executing it, so CREATE INDEX referencing a newly-added column in the same
-- migration fails at parse time. Column add and index must be in separate migrations.
ALTER TABLE guests
    ADD sheet_sync_id NVARCHAR(36) NULL;
