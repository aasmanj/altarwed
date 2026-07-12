-- V89: let couples choose the printed card's shape/size (portrait vs landscape) instead of the
-- single hardcoded 6x11 landscape. The choice is made at order-creation time but the actual Lob
-- render runs later, asynchronously, once Stripe confirms payment (issue #53/#59), so it MUST be
-- persisted on the order rather than held in-memory.
--
-- Nullable on purpose: every order created before this predates the choice, and the Lob adapter
-- treats NULL as LANDSCAPE_6X11 (the original, proven 6x11 dimensions) so legacy rows and any
-- in-flight order render exactly as before.
--
-- Inline CHECK constraint (single statement) per the SQL Server + Flyway rule in backend/CLAUDE.md:
-- a separate ADD CONSTRAINT statement in the same transaction fails name resolution at parse time.
ALTER TABLE print_orders ADD card_size NVARCHAR(20) NULL
    CONSTRAINT chk_print_orders_card_size
    CHECK (card_size IN ('LANDSCAPE_6X11', 'PORTRAIT_6X9', 'PORTRAIT_5X7'));
