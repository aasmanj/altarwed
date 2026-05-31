-- Idempotency key for print orders.
--
-- Print orders mail and bill real postcards via Lob (~$1.50 each). Without a
-- dedup key, a double-click, a browser refresh, or an HTTP retry creates a
-- second order and mails/charges the whole batch again. The client now sends a
-- per-submit UUID; the backend treats a repeat of the same (couple_id,
-- idempotency_key) as the same order and returns the original instead of
-- re-submitting to Lob.
--
-- The ALTER and the index live in separate batches (GO) because SQL Server
-- resolves column names at parse time within a batch and cannot see a column
-- added earlier in the same batch (same reasoning as the CLAUDE.md inline-
-- constraint rule, applied to a filtered index that can't be declared inline).

ALTER TABLE print_orders ADD idempotency_key NVARCHAR(64) NULL;
GO

-- Filtered unique index: at most one order per couple per key, while still
-- allowing many legacy rows with NULL keys. This is the hard guarantee that a
-- racing duplicate submit cannot create two charged orders.
CREATE UNIQUE INDEX ux_print_orders_couple_idempotency
    ON print_orders (couple_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
GO
