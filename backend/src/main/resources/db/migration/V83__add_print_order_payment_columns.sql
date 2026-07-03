-- Issues #59 + #53: couples now pay via Stripe before a print order reaches Lob, and the
-- Lob submit loop runs off the HTTP thread. New state machine:
--   PENDING_PAYMENT -> PROCESSING -> SUBMITTED | PARTIAL_FAILURE | FAILED
-- DRAFT stays in the CHECK constraint for existing historical rows; new orders never use it.
-- SQL Server CHECK constraints require a DROP + ADD to modify the allowed value list.
ALTER TABLE print_orders DROP CONSTRAINT chk_print_order_status;
ALTER TABLE print_orders ADD CONSTRAINT chk_print_order_status CHECK (status IN (
    'DRAFT', 'PENDING_PAYMENT', 'PROCESSING', 'SUBMITTED', 'PARTIAL_FAILURE', 'FAILED', 'MAILED'
));

-- Stripe payment tracking. All nullable: a PENDING_PAYMENT order has a checkout session id but
-- no payment intent id yet (Stripe only attaches one once the couple actually pays); historical
-- pre-#59 orders have none of these at all.
ALTER TABLE print_orders ADD stripe_checkout_session_id NVARCHAR(255) NULL;
ALTER TABLE print_orders ADD stripe_payment_intent_id NVARCHAR(255) NULL;
ALTER TABLE print_orders ADD amount_charged_cents INT NULL;
ALTER TABLE print_orders ADD amount_refunded_cents INT NOT NULL DEFAULT 0;

-- The Lob submit batch now runs asynchronously (issue #53), triggered later by the Stripe
-- webhook confirming payment -- a separate invocation from the HTTP request that created the
-- order, so the return-address block (previously only ever held in-memory for the duration of
-- the synchronous request) must be persisted for the async batch to read.
ALTER TABLE print_orders ADD return_name NVARCHAR(200) NULL;
ALTER TABLE print_orders ADD return_address_line1 NVARCHAR(200) NULL;
ALTER TABLE print_orders ADD return_address_line2 NVARCHAR(200) NULL;
ALTER TABLE print_orders ADD return_city NVARCHAR(100) NULL;
ALTER TABLE print_orders ADD return_state NVARCHAR(50) NULL;
ALTER TABLE print_orders ADD return_zip NVARCHAR(20) NULL;

-- Real delivery tracking (issue #59 UX ask), replacing the previous plan to promise a "delivery
-- guarantee" that USPS First-Class mail does not actually offer. Lob's postcard object already
-- carries these; the adapter previously read but discarded them.
ALTER TABLE print_order_recipients ADD tracking_number NVARCHAR(64) NULL;
ALTER TABLE print_order_recipients ADD expected_delivery_date DATE NULL;
