-- Couple activation win-back sequence, send-once ledger (issue #551).
--
-- A couple who registers and never publishes a wedding website used to receive exactly one email
-- ever (the welcome). CoupleWinbackService now nudges them at 2, 7, and 21 days after signup while
-- they are still unpublished. This table is the dedupe record: one row per (couple, touch), written
-- in the same transaction as the outbox enqueue, so a nudge is queued at most once no matter how
-- many times the hourly job runs, restarts, or is replayed after an outage.
--
-- The UNIQUE constraint is the guarantee, not the candidate query's NOT EXISTS filter: two
-- instances racing past the ShedLock would both pass the filter, and exactly one insert wins. The
-- loser's transaction rolls back and takes its outbox row with it.
--
-- touch stores the CoupleWinbackTouch enum name. The CHECK pins the allowed values so a hand-run
-- INSERT cannot introduce a touch the application does not know how to render. Adding a fourth
-- touch means a new migration that widens this constraint.
--
-- ON DELETE CASCADE: this is relationship state tied to a couple, so deleting the account removes
-- it (same pattern as save_the_date_sends V86 and rsvp_invite_bulk_sends V88). Note the account
-- deletion path also records the anonymised unsubscribe preference, so a deleted-then-returning
-- address is not re-nudged from stale suppression state.
--
-- Additive only: creates one new table and one new index. No existing row or column is touched.

CREATE TABLE couple_winback_sends (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_couple_winback_sends_id DEFAULT NEWID(),
    couple_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_couple_winback_sends_couple REFERENCES couples (id) ON DELETE CASCADE,
    touch      NVARCHAR(16)     NOT NULL CONSTRAINT chk_couple_winback_sends_touch CHECK (touch IN ('DAY_2', 'DAY_7', 'DAY_21')),
    sent_at    DATETIME2        NOT NULL CONSTRAINT df_couple_winback_sends_sent_at DEFAULT GETUTCDATE(),
    -- PK nonclustered on the random GUID; cluster on (couple_id, touch) because that is the only
    -- access path (the NOT EXISTS dedupe probe and the ON DELETE CASCADE seek), and because at most
    -- one row per (couple, touch) IS the send-once guarantee.
    CONSTRAINT pk_couple_winback_sends PRIMARY KEY NONCLUSTERED (id),
    CONSTRAINT uq_couple_winback_sends_couple_touch UNIQUE CLUSTERED (couple_id, touch)
);

-- Supports the hourly candidate scan, which seeks a narrow signup window
-- (WHERE is_active = 1 AND created_at >= ? AND created_at < ?). Without it every run scans the
-- whole couples table, which gets worse with exactly the growth this feature exists to drive.
-- Filtered on is_active = 1 so deactivated accounts never enter the index and never get nudged.
CREATE INDEX ix_couples_created_at_active
    ON couples (created_at)
    WHERE is_active = 1;
