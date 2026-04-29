-- V2: Create vendors table and vendor_denomination_ids join table
-- Vendors are the supply side of the marketplace — photographers, florists, venues, etc.
-- denomination_ids stored in a separate join table to support multi-denomination vendors.

CREATE TABLE vendors (
    id                  UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    business_name       NVARCHAR(200)       NOT NULL,
    category            NVARCHAR(50)        NOT NULL,
    city                NVARCHAR(100)       NOT NULL,
    state               NVARCHAR(50)        NOT NULL,
    email               NVARCHAR(255)       NOT NULL,
    password_hash       NVARCHAR(255)       NOT NULL,
    is_christian_owned  BIT                 NOT NULL DEFAULT 0,
    is_active           BIT                 NOT NULL DEFAULT 1,
    is_verified         BIT                 NOT NULL DEFAULT 0,
    created_at          DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_vendors PRIMARY KEY (id),
    CONSTRAINT uq_vendors_email UNIQUE (email),
    CONSTRAINT chk_vendors_category CHECK (category IN (
        'PHOTOGRAPHER', 'VIDEOGRAPHER', 'FLORIST', 'CATERER', 'VENUE',
        'OFFICIANT', 'MUSIC', 'CAKE', 'HAIR_AND_MAKEUP', 'INVITATION',
        'TRANSPORTATION', 'COORDINATOR', 'OTHER'
    ))
);

CREATE TABLE vendor_denomination_ids (
    vendor_id           UNIQUEIDENTIFIER    NOT NULL,
    denomination_id     UNIQUEIDENTIFIER    NOT NULL,

    CONSTRAINT pk_vendor_denomination_ids PRIMARY KEY (vendor_id, denomination_id),
    CONSTRAINT fk_vendor_denomination_ids_vendor FOREIGN KEY (vendor_id)
        REFERENCES vendors (id) ON DELETE CASCADE
);

CREATE INDEX ix_vendors_city             ON vendors (city);
CREATE INDEX ix_vendors_category         ON vendors (category);
CREATE INDEX ix_vendors_city_category    ON vendors (city, category);
CREATE INDEX ix_vendors_is_active        ON vendors (is_active);
CREATE INDEX ix_vendor_denomination_ids  ON vendor_denomination_ids (vendor_id);
