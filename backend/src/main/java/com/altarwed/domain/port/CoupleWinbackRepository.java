package com.altarwed.domain.port;

import com.altarwed.domain.model.email.CoupleWinbackCandidate;
import com.altarwed.domain.model.email.CoupleWinbackTouch;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Read/write port for the couple activation win-back sequence (issue #551).
 *
 * Two responsibilities, both deliberately expressed as one round trip each so the hourly job
 * never pulls the couples table into memory to filter in Java:
 *   - find the couples due for one touch (signed up inside the touch's window, still active,
 *     no published website, not already sent this touch);
 *   - record that a touch was sent, which is the send-once guarantee.
 */
public interface CoupleWinbackRepository {

    /**
     * Couples due for {@code touch}: created in [signedUpFrom, signedUpUntil), still active, with
     * no published (non-deleted) wedding website and no existing send marker for this touch.
     *
     * {@code onOrAfterWeddingDate} drops couples whose wedding has already passed: nudging someone
     * to build a website for a wedding that already happened is noise, not retention. Couples with
     * no date set are kept (most brand-new signups have not picked one yet).
     *
     * {@code limit} bounds one run so a backlog drains over several hours instead of one burst
     * against the email provider's rate limit.
     */
    List<CoupleWinbackCandidate> findWinbackCandidates(CoupleWinbackTouch touch,
                                                       LocalDateTime signedUpFrom,
                                                       LocalDateTime signedUpUntil,
                                                       LocalDate onOrAfterWeddingDate,
                                                       int limit);

    /**
     * Records that {@code touch} was sent to {@code coupleId}. The underlying unique constraint on
     * (couple_id, touch) is the hard send-once guarantee: a duplicate insert fails rather than
     * silently allowing a second nudge.
     */
    void recordSent(UUID coupleId, CoupleWinbackTouch touch, LocalDateTime sentAt);
}
