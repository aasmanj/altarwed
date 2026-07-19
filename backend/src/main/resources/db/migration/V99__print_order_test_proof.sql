-- Issue #208: a couple can order a single test postcard mailed to their OWN return address to
-- proof the real printed card (layout, headline, date, QR) before paying for the full guest
-- batch. The test is a real PrintOrder that goes through the exact same paid Stripe Checkout ->
-- webhook -> async Lob submit path as a normal order (there is no free/$0 send path); the new
-- TEST_PROOF order type only labels it, honestly, in Past Orders.
-- SQL Server CHECK constraints require a DROP + ADD to modify the allowed value list (same
-- pattern as V83 for chk_print_order_status).
ALTER TABLE print_orders DROP CONSTRAINT chk_print_order_type;
ALTER TABLE print_orders ADD CONSTRAINT chk_print_order_type CHECK (order_type IN (
    'SAVE_THE_DATE', 'INVITATION', 'TEST_PROOF'
));

-- A test-proof recipient is the couple themselves (addressed via the order's persisted return_*
-- block), not a guest, so guest_id becomes nullable. SQL Server refuses ALTER COLUMN on a column
-- participating in a FOREIGN KEY constraint, so drop the FK, alter, and re-add it; the FK still
-- validates every non-null guest_id exactly as before (FKs ignore NULLs by definition).
ALTER TABLE print_order_recipients DROP CONSTRAINT fk_print_order_recipients_guest;
ALTER TABLE print_order_recipients ALTER COLUMN guest_id UNIQUEIDENTIFIER NULL;
ALTER TABLE print_order_recipients ADD CONSTRAINT fk_print_order_recipients_guest FOREIGN KEY (guest_id) REFERENCES guests(id);
