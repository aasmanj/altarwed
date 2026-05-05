CREATE TABLE rsvp_invite_tokens (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    token_hash NVARCHAR(64)     NOT NULL,
    guest_id   UNIQUEIDENTIFIER NOT NULL,
    expires_at DATETIME2        NOT NULL,
    used       BIT              NOT NULL DEFAULT 0,
    used_at    DATETIME2        NULL,
    created_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT fk_rsvp_tokens_guest FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_rsvp_invite_tokens_hash     ON rsvp_invite_tokens(token_hash);
CREATE        INDEX ix_rsvp_invite_tokens_guest_id ON rsvp_invite_tokens(guest_id);
