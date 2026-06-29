-- V75: DB-backed vendor comp promo codes (single-use / capped / expiring / audited).
--
-- Replaces the single hardcoded env-var code (altarwed.vendor.promo-code, default FREEVENDOR),
-- which had no usage cap, no expiry, and no audit trail: anyone who learned it could claim
-- unlimited free FEATURED listings forever. Once the directory has commercial value that is a
-- revenue leak.
--
-- vendor_promo_codes holds the issued codes plus their limits; redeemed_count is incremented on
-- each successful redemption so the cap check is a single read. vendor_promo_redemptions is the
-- append-only audit trail of who redeemed which code and when.
--
-- Additive only: no existing table is altered. VendorPromoService keeps validating against the
-- env-var code while this table is empty (backward compatibility for existing deployments), and
-- switches to these rows as soon as the first admin-issued code exists.

CREATE TABLE vendor_promo_codes (
    id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()           CONSTRAINT pk_vendor_promo_codes PRIMARY KEY,
    code            NVARCHAR(100)    NOT NULL,
    max_redemptions INT              NULL,
    expires_at      DATETIMEOFFSET   NULL,
    redeemed_count  INT              NOT NULL DEFAULT 0,
    created_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT uq_vendor_promo_codes_code UNIQUE (code)
);

CREATE TABLE vendor_promo_redemptions (
    id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()           CONSTRAINT pk_vendor_promo_redemptions PRIMARY KEY,
    code_id     UNIQUEIDENTIFIER NOT NULL,
    vendor_id   UNIQUEIDENTIFIER NOT NULL,
    redeemed_at DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT fk_vendor_promo_redemptions_code FOREIGN KEY (code_id)
        REFERENCES vendor_promo_codes (id) ON DELETE CASCADE
);

-- Redemption stats join back to their code; admin listing and the audit lookups read by code_id.
CREATE INDEX ix_vendor_promo_redemptions_code   ON vendor_promo_redemptions (code_id);
CREATE INDEX ix_vendor_promo_redemptions_vendor ON vendor_promo_redemptions (vendor_id);
