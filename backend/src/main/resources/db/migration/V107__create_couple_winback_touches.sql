-- Send-once ledger for the couple win-back sequence (issue #551).
--
-- A couple who signs up but never publishes their wedding website used to hear nothing after
-- the welcome mail (the largest retention leak). CoupleWinbackService now sends up to three
-- warm nudges (about 2, 7, and 21 days after signup) through the durable email outbox. This
-- table records which touches a couple has already received so a job re-run, a scale-out to
-- more App Service instances, or a crash mid-batch can never send the same touch twice.
--
-- CoupleWinbackSender inserts one row here in the SAME transaction as the outbox enqueue, so a
-- recorded touch was always queued and a queued touch was always recorded. The unique index on
-- (couple_id, touch) is the hard dedupe guarantee: two writers racing to send the same touch
-- both try to insert, exactly one wins, and the loser's transaction rolls back (taking its
-- outbox row with it) instead of mailing a duplicate.
--
-- touch is the CoupleWinbackTouch enum name; the inline CHECK keeps a bad value out at write
-- time (SQL Server + Flyway DDL rule: single statement, inline constraint, per backend/CLAUDE.md).
--
-- ON DELETE CASCADE: this is relationship state tied to a couple, so deleting the couple's
-- account removes it. FK matches couples(id) from V1 (same pattern as rsvp_invite_bulk_sends, V88).

CREATE TABLE couple_winback_touches (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_couple_winback_id DEFAULT NEWID(),
    couple_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_couple_winback_couple REFERENCES couples (id) ON DELETE CASCADE,
    touch      NVARCHAR(16)     NOT NULL CONSTRAINT chk_couple_winback_touch CHECK (touch IN ('DAY_2', 'DAY_7', 'DAY_21')),
    sent_at    DATETIME2        NOT NULL CONSTRAINT df_couple_winback_sent_at DEFAULT GETUTCDATE(),
    -- PK nonclustered on the random GUID; cluster on (couple_id, touch) since that is the only
    -- access path: the send-once lookup (findSentTouches by couple_id), the insert's uniqueness
    -- check, and the ON DELETE CASCADE seek. At most one row per (couple, touch), which is the
    -- dedupe guarantee itself.
    CONSTRAINT pk_couple_winback_touches PRIMARY KEY NONCLUSTERED (id),
    CONSTRAINT uq_couple_winback_touch UNIQUE CLUSTERED (couple_id, touch)
);

-- The hourly candidate scan (CoupleJpaRepository.findActiveCreatedBetween) filters couples on
-- is_active = 1 AND created_at BETWEEN :from AND :to. couples is indexed only on email and
-- wedding_date (V1), so without this the job full-scans the table every hour, forever, and the
-- cost grows with every signup. A filtered index matches the query's predicate exactly and stays
-- small: it only contains active couples, ordered by created_at, which is precisely the slice the
-- window reads.
CREATE INDEX ix_couples_active_created ON couples (created_at) WHERE is_active = 1;
