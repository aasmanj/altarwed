-- V1: Create couples table
-- Couples are the primary users of AltarWed — one account per engaged pair.
-- denomination_id is nullable because couples may not identify a denomination at registration.

CREATE TABLE couples (
    id                  UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    partner_one_name    NVARCHAR(100)       NOT NULL,
    partner_two_name    NVARCHAR(100)       NOT NULL,
    email               NVARCHAR(255)       NOT NULL,
    password_hash       NVARCHAR(255)       NOT NULL,
    wedding_date        DATE                NULL,
    denomination_id     UNIQUEIDENTIFIER    NULL,
    is_active           BIT                 NOT NULL DEFAULT 1,
    created_at          DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_couples PRIMARY KEY (id),
    CONSTRAINT uq_couples_email UNIQUE (email)
);

CREATE INDEX ix_couples_email     ON couples (email);
CREATE INDEX ix_couples_wedding_date ON couples (wedding_date);
