-- Append-only audit log of every email subscription state change, for CAN-SPAM
-- defensibility. The email_suppression table holds only the CURRENT state (a row
-- exists iff the address is suppressed right now); when a couple resubscribes a
-- guest that row is deleted, which would otherwise erase all proof that the address
-- ever opted out and that we honoured it. This table is never deleted from: each
-- suppress/unsuppress writes one immutable row so we can reconstruct, for any
-- address, exactly when it opted out, why (USER_REQUEST / BOUNCE / COMPLAINT), and
-- when/by whom it was resubscribed (COUPLE_REQUEST).
--
-- Keyed by the same SHA-256 email_hash as email_suppression so the raw address is
-- never stored. No unique constraint: many events per hash over time is expected.
CREATE TABLE email_subscription_event (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_email_sub_event_id DEFAULT NEWID(),
    email_hash    NVARCHAR(64)     NOT NULL,
    action        NVARCHAR(20)     NOT NULL CONSTRAINT chk_email_sub_event_action CHECK (action IN ('SUPPRESSED', 'RESUBSCRIBED')),
    source        NVARCHAR(50)     NOT NULL,
    created_at    DATETIME2        NOT NULL CONSTRAINT df_email_sub_event_created_at DEFAULT GETUTCDATE(),
    CONSTRAINT pk_email_subscription_event PRIMARY KEY (id)
);

-- Supports the canonical query: the full timeline for one address, oldest first.
CREATE INDEX ix_email_sub_event_hash ON email_subscription_event (email_hash, created_at);
