-- One-time vendor listing-completion nudge receipts (issue #557).
--
-- VENDOR_WELCOME fires at registration and VENDOR_VERIFIED when the listing goes live, but
-- nothing nudges a vendor whose listing is still missing the assets that actually convert
-- couples (logo, bio, portfolio photos). VendorListingNudgeService sends exactly one nudge
-- per vendor, on or after day 3, and only while the listing is still incomplete.
--
-- This table is the dedup ledger for that "exactly one, ever" guarantee. A row is inserted in
-- the SAME transaction as the outbox enqueue, so a queued nudge is always recorded and a
-- recorded nudge was always queued. The UNIQUE CLUSTERED (vendor_id) constraint is the hard
-- guarantee rather than a read-then-write check: if two scaled-out instances (or a re-run after
-- a crash between enqueue and commit) race on the same vendor, exactly one INSERT wins and the
-- loser's whole transaction rolls back, taking its outbox row with it. No second email.
--
-- The PK is NONCLUSTERED on the random GUID and the table is CLUSTERED on vendor_id because
-- vendor_id is the only access path (the dedup existence check and the ON DELETE CASCADE seek);
-- clustering on a random GUID would only cause page splits. Same shape as save_the_date_sends
-- (V86) and rsvp_invite_bulk_sends (V88).
--
-- ON DELETE CASCADE: a nudge receipt is state about a vendor with no meaning once the vendor
-- row is gone, so it dies with the vendor.
--
-- Inline DEFAULT/FK constraints per the SQL Server + Flyway DDL rule in backend/CLAUDE.md
-- (never add a column then a constraint referencing it as two separate statements).

CREATE TABLE vendor_listing_nudge_sends (
    id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_vendor_listing_nudge_id DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_vendor_listing_nudge_vendor REFERENCES vendors (id) ON DELETE CASCADE,
    sent_at   DATETIME2        NOT NULL CONSTRAINT df_vendor_listing_nudge_sent_at DEFAULT GETUTCDATE(),
    CONSTRAINT pk_vendor_listing_nudge_sends PRIMARY KEY NONCLUSTERED (id),
    CONSTRAINT uq_vendor_listing_nudge_sends_vendor UNIQUE CLUSTERED (vendor_id)
);
