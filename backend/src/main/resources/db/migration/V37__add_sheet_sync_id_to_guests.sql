-- Stable identifier written back to the couple's Google Sheet so the sync
-- can match rows reliably even when the guest name or email changes over time.
-- Null for guests added manually or synced before write-back was introduced.
ALTER TABLE guests
    ADD sheet_sync_id NVARCHAR(36) NULL;

-- Partial index: only indexes rows that have a UUID stamped; most manual-add
-- guests will have NULL and are excluded, keeping the index small.
CREATE INDEX ix_guests_sheet_sync_id
    ON guests (couple_id, sheet_sync_id)
    WHERE sheet_sync_id IS NOT NULL;
