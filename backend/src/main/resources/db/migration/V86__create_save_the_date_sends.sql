-- Idempotency receipts for the save-the-date batch send (issue #232).
--
-- sendSaveDates emails guests and stamps guests.save_the_date_sent_at. With no dedup
-- key, a send that succeeds on the server but whose HTTP response is lost (mobile
-- network, cold start) leaves the couple seeing nothing; they retry, and with an
-- explicit guest selection that re-emails guests who already received the announcement.
--
-- The client now sends a per-attempt UUID. The backend records one receipt per
-- (couple_id, idempotency_key) BEFORE the async email fan-out and the stamp, so a repeat
-- of the same key returns the original summary instead of re-sending. The unique index is
-- the hard guarantee: two concurrent submits with the same key race to insert, exactly one
-- wins, and the loser replays the winner's summary rather than mailing the batch twice.
--
-- Mirrors the print_orders idempotency model (V43) but as a dedicated receipt table, since
-- a save-the-date send has no order row of its own to carry the key.
--
-- ON DELETE CASCADE: a receipt is relationship state tied to a couple, so deleting the
-- couple's account removes it. FK matches couples(id) from V1 (same pattern as V69).

CREATE TABLE save_the_date_sends (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_std_send_id DEFAULT NEWID(),
    couple_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_std_send_couple REFERENCES couples (id) ON DELETE CASCADE,
    idempotency_key  NVARCHAR(64)     NOT NULL,
    queued_count     INT              NOT NULL,
    invalid_count    INT              NOT NULL,
    suppressed_count INT              NOT NULL,
    created_at       DATETIME2        NOT NULL CONSTRAINT df_std_send_created_at DEFAULT GETUTCDATE(),
    -- PK nonclustered on the random GUID; cluster on (couple_id, idempotency_key) since that
    -- is the only access path: the replay lookup and the ON DELETE CASCADE seek. At most one
    -- receipt per (couple, key), which is the idempotency guarantee itself.
    CONSTRAINT pk_save_the_date_sends PRIMARY KEY NONCLUSTERED (id),
    CONSTRAINT uq_save_the_date_sends_couple_key UNIQUE CLUSTERED (couple_id, idempotency_key)
);
