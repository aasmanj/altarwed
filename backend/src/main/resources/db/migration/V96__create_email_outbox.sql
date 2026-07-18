-- Durable email outbox (issue #377).
--
-- Every transactional email used to be handed to an in-memory @Async executor
-- (AsyncConfig.emailExecutor, queue capacity 200). A direct-to-prod restart or a
-- crash drops whatever is still queued, so a couple who clicked "send 150 invites"
-- can believe the batch went out when it never did. This table is the transactional
-- outbox: the business operation writes a durable send-intent row in its own
-- transaction, and a scheduled sender drains PENDING rows, calls the email provider,
-- and marks each row SENT (or retries with backoff, or gives up to FAILED).
--
-- payload holds the JSON form of the type-specific argument record so the sender can
-- reconstruct the exact original send. recipient is a single low-cardinality address
-- kept only for operational queries and is NULL for batch sends (which fan out many
-- recipients from the payload). last_error is a truncated, non-PII diagnostic string.
--
-- Inline DEFAULT/CHECK constraints per the SQL Server + Flyway DDL rule in
-- backend/CLAUDE.md (never add a column then a constraint referencing it as two
-- separate statements in the same migration).

CREATE TABLE email_outbox (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_email_outbox_id DEFAULT NEWID(),
    email_type       NVARCHAR(64)     NOT NULL,
    recipient        NVARCHAR(320)    NULL,
    payload          NVARCHAR(MAX)    NOT NULL,
    status           NVARCHAR(16)     NOT NULL CONSTRAINT df_email_outbox_status DEFAULT 'PENDING'
                         CONSTRAINT chk_email_outbox_status CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts         INT              NOT NULL CONSTRAINT df_email_outbox_attempts DEFAULT 0,
    next_attempt_at  DATETIME2        NOT NULL CONSTRAINT df_email_outbox_next_attempt_at DEFAULT GETUTCDATE(),
    created_at       DATETIME2        NOT NULL CONSTRAINT df_email_outbox_created_at DEFAULT GETUTCDATE(),
    sent_at          DATETIME2        NULL,
    last_error       NVARCHAR(2000)   NULL,
    CONSTRAINT pk_email_outbox PRIMARY KEY (id)
);

-- The sender's only hot access path is "give me the due PENDING rows, oldest first".
-- A filtered index over just the PENDING rows keeps the drain query seeking a small,
-- shrinking set rather than scanning the whole (mostly SENT) table as it grows.
CREATE INDEX ix_email_outbox_pending
    ON email_outbox (next_attempt_at, created_at)
    WHERE status = 'PENDING';
