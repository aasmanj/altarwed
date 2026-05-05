-- V9: Password reset tokens
-- Stores SHA-256 hashed one-time tokens for the forgot-password flow.
-- Raw token is emailed; only the hash is persisted (same security model as refresh_tokens).
-- is_used prevents replay if the token is consumed before it expires.

CREATE TABLE password_reset_tokens (
    id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    token_hash  VARCHAR(64)      NOT NULL,
    email       VARCHAR(255)     NOT NULL,
    expires_at  DATETIME2        NOT NULL,
    is_used     BIT              NOT NULL DEFAULT 0,
    created_at  DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_prt_email      ON password_reset_tokens (email);
CREATE INDEX ix_prt_token_hash ON password_reset_tokens (token_hash);
