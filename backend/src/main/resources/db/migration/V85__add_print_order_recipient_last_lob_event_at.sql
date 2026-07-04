-- Issue #52: track the timestamp of the last-applied Lob webhook event per recipient, mirroring
-- V84's vendor_subscriptions.last_stripe_event_at, so an out-of-order or redelivered Lob delivery
-- webhook can never regress a more-advanced delivery status.
ALTER TABLE print_order_recipients ADD last_lob_event_at DATETIME2 NULL;

-- Every Lob webhook delivery correlates its event to a recipient by lob_postcard_id; this table
-- has no index on that column today (only on print_order_id), so every webhook would otherwise
-- table-scan.
CREATE INDEX ix_print_order_recipients_lob_postcard_id ON print_order_recipients(lob_postcard_id);
