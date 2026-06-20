-- Append-only audit log of every email subscription state change, for CAN-SPAM
-- defensibility. The live state lives in two places (global email_suppression for
-- COMPLAINT/BOUNCE; per-couple couple_email_optout for voluntary unsubscribes), and
-- both are mutated/deleted over time; this table is never deleted from, so for any
-- address we can reconstruct exactly when it opted out, why (USER_REQUEST / BOUNCE /
-- COMPLAINT), and when/how it was resubscribed (GUEST_RSVP). couple_id records WHICH
-- relationship the event belongs to (NULL = a global, address-level event such as a
-- bounce or complaint), so the record names the actor, not just the action.
--
-- Keyed by the same SHA-256 email_hash as the live tables so the raw address is never
-- stored. No unique constraint: many events per hash over time is expected.
CREATE TABLE email_subscription_event (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_email_sub_event_id DEFAULT NEWID(),
    email_hash    NVARCHAR(64)     NOT NULL,
    couple_id     UNIQUEIDENTIFIER NULL,
    action        NVARCHAR(20)     NOT NULL CONSTRAINT chk_email_sub_event_action CHECK (action IN ('SUPPRESSED', 'RESUBSCRIBED')),
    source        NVARCHAR(50)     NOT NULL,
    created_at    DATETIME2        NOT NULL CONSTRAINT df_email_sub_event_created_at DEFAULT GETUTCDATE(),
    CONSTRAINT pk_email_subscription_event PRIMARY KEY (id)
);

-- Supports the canonical query: the full timeline for one address, oldest first.
CREATE INDEX ix_email_sub_event_hash ON email_subscription_event (email_hash, created_at);
