-- V76: Enforce one redemption per vendor per promo code at the database layer.
--
-- V75 created vendor_promo_redemptions as an append-only audit trail but left the
-- (code_id, vendor_id) pair unconstrained. That meant the ONLY guard against a vendor
-- redeeming the same code twice was the application-layer logic in VendorPromoService.
-- Under concurrency (two redeem requests for the same vendor + code racing) both can pass
-- the in-memory cap check before either commits, so a vendor could burn multiple slots of a
-- capped code and inflate redeemed_count past the real number of unique comped vendors.
--
-- This UNIQUE constraint closes that race: the second concurrent INSERT fails at the DB,
-- VendorPromoService catches the DataIntegrityViolationException and returns a clean 4xx
-- "already redeemed" instead of double-granting. The matching ix_vendor_promo_redemptions_*
-- indexes from V75 are kept (they serve the code_id-only and vendor_id-only lookups; the new
-- composite unique index does not cover the vendor_id-only path).
--
-- Additive only: no existing column, table, or data is altered. Safe to apply on a populated
-- table provided no vendor has already double-redeemed (none can have at the time of writing,
-- since the table is empty until the first admin-issued code is redeemed).

ALTER TABLE vendor_promo_redemptions
    ADD CONSTRAINT uq_vendor_promo_redemptions_code_vendor UNIQUE (code_id, vendor_id);
