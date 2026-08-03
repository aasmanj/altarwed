package com.altarwed.domain.port;

import com.altarwed.domain.model.email.CoupleWinbackTouch;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * Durable send-once ledger for the couple win-back sequence (issue #551). One row per
 * (couple, touch) records that a given nudge has been sent, so a job re-run, a scale-out to
 * more instances, or a crash mid-batch can never send the same touch twice.
 *
 * The uniqueness of (couple_id, touch) is enforced in the database, not just here: the
 * application-level {@link #findSentTouches} pre-check keeps the common case cheap, and the
 * unique constraint is the hard backstop that turns a concurrent double-send into a failed
 * insert (one writer wins, the other rolls back) rather than a duplicate email.
 */
public interface CoupleWinbackTouchRepository {

    /**
     * The touches already sent to this couple. Read once per candidate so the scheduler can
     * skip a touch it has already delivered without a query per touch.
     */
    Set<CoupleWinbackTouch> findSentTouches(UUID coupleId);

    /**
     * Records that {@code touch} has been sent to {@code coupleId} at {@code sentAt}. Throws if a
     * row for the same (couple, touch) already exists (the unique constraint): the caller runs
     * this in the same transaction as the outbox enqueue, so a duplicate insert rolls back the
     * enqueue too and no second email is committed.
     */
    void recordSent(UUID coupleId, CoupleWinbackTouch touch, LocalDateTime sentAt);
}
