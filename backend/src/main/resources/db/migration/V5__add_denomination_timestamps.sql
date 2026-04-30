-- V5: Add created_at / updated_at audit columns to denominations.
-- Seeded rows from V3 get the current timestamp as a safe default.

ALTER TABLE denominations
    ADD created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
