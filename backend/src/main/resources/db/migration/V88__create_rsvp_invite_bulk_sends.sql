-- Idempotency receipts for the bulk RSVP invite send (issue #295).
--
-- sendInvitesBulk emails the couple's selected guests and increments each guest's
-- invite_send_count. With no dedup key, a send that succeeds on the server but whose
-- HTTP response is lost (mobile network, cold start) shows the couple an error toast
-- that says "try again"; they obey, and every still-under-cap guest in the selection
-- receives a duplicate invite email.
--
-- The client now sends a per-attempt UUID. The backend records one receipt per
-- (couple_id, idempotency_key) BEFORE the invite fan-out, so a repeat of the same key
-- returns the original summary instead of re-sending. The unique index is the hard
-- guarantee: two concurrent submits with the same key race to insert, exactly one wins,
-- and the loser replays the winner's summary rather than mailing the batch twice.
--
-- Mirrors save_the_date_sends (V86) exactly; the counts differ because the bulk invite
-- summary is sent/skipped (skip reasons are reported live but not replayed).
--
-- ON DELETE CASCADE: a receipt is relationship state tied to a couple, so deleting the
-- couple's account removes it. FK matches couples(id) from V1 (same pattern as V86).

CREATE TABLE rsvp_invite_bulk_sends (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_bulk_invite_id DEFAULT NEWID(),
    couple_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_bulk_invite_couple REFERENCES couples (id) ON DELETE CASCADE,
    idempotency_key  NVARCHAR(64)     NOT NULL,
    sent_count       INT              NOT NULL,
    skipped_count    INT              NOT NULL,
    created_at       DATETIME2        NOT NULL CONSTRAINT df_bulk_invite_created_at DEFAULT GETUTCDATE(),
    -- PK nonclustered on the random GUID; cluster on (couple_id, idempotency_key) since that
    -- is the only access path: the replay lookup and the ON DELETE CASCADE seek. At most one
    -- receipt per (couple, key), which is the idempotency guarantee itself.
    CONSTRAINT pk_rsvp_invite_bulk_sends PRIMARY KEY NONCLUSTERED (id),
    CONSTRAINT uq_rsvp_invite_bulk_sends_couple_key UNIQUE CLUSTERED (couple_id, idempotency_key)
);
