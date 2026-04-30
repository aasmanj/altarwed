-- V4: Persist refresh tokens so they can be validated and rotated server-side.
-- Storing a SHA-256 hash of the token string — never the raw token.

CREATE TABLE refresh_tokens (
    id          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    token_hash  NVARCHAR(64)        NOT NULL,
    user_id     UNIQUEIDENTIFIER    NOT NULL,
    user_role   NVARCHAR(20)        NOT NULL,
    expires_at  DATETIME2           NOT NULL,
    revoked     BIT                 NOT NULL DEFAULT 0,
    created_at  DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX ix_refresh_tokens_user_id   ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_expires   ON refresh_tokens (expires_at);
