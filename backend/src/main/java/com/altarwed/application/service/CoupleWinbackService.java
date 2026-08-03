package com.altarwed.application.service;

import com.altarwed.domain.model.email.CoupleWinbackCandidate;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleWinbackRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Couple activation win-back sequence (issue #551).
 *
 * A couple who registers and never publishes a wedding website used to receive exactly one email
 * ever (the welcome), which made signup-without-activation the largest retention leak on the
 * platform. Once per hour this scheduler finds the couples who crossed a touch boundary (2, 7, and
 * 21 days after signup) while still unpublished, and enqueues at most one nudge per touch per
 * couple through the durable email outbox.
 *
 * Why a poll loop rather than per-couple scheduled messages: the same reasoning as
 * {@link RsvpReminderService} and {@link CampaignReminderService}. The query is bounded (a
 * two-day-wide signup window per touch, capped at {@link #MAX_PER_TOUCH_PER_RUN} rows), it needs no
 * broker, and it survives restarts without extra infrastructure. Swap in Service Bus scheduled
 * messages behind the same port when sub-hour precision or many drainers are needed.
 *
 * Send-once is enforced in the database, not in memory: {@code couple_winback_sends} has a unique
 * constraint on (couple_id, touch), the candidate query excludes couples that already have a marker
 * for the touch, and {@link CoupleWinbackSender} commits the enqueue and the marker together. A
 * missed run, a restart, or a scale-out (guarded additionally by {@code @SchedulerLock}) therefore
 * cannot produce a duplicate nudge.
 *
 * The scheduler itself is intentionally NOT {@code @Transactional}: each per-couple send is its own
 * committed unit of work, so one failure is a WARN and a skip, never a batch-wide rollback.
 */
@Service
public class CoupleWinbackService {

    private static final Logger log = LoggerFactory.getLogger(CoupleWinbackService.class);

    /**
     * How far back before the touch boundary a couple still qualifies. A two-day-wide window
     * absorbs the hourly cadence plus a full day of downtime (or a deploy freeze) without letting a
     * couple slip past a touch unnudged. Widening it does not risk duplicates (the marker is the
     * guarantee); it only changes how late a delayed nudge may arrive.
     */
    static final int WINDOW_WIDTH_DAYS = 2;

    /**
     * Couples processed per touch per run. Bounds the outbox burst so a backlog (first deploy, or a
     * spike of signups) drains over a few hours instead of queueing thousands of rows at once
     * against the provider's rate limit. Leftovers are picked up on the next run, still inside the
     * window.
     */
    static final int MAX_PER_TOUCH_PER_RUN = 200;

    private final CoupleWinbackRepository winbackRepository;
    private final EmailSuppressionService suppressionService;
    private final CoupleWinbackSender sender;

    public CoupleWinbackService(CoupleWinbackRepository winbackRepository,
                                EmailSuppressionService suppressionService,
                                CoupleWinbackSender sender) {
        this.winbackRepository = winbackRepository;
        this.suppressionService = suppressionService;
        this.sender = sender;
    }

    // fixedRate = 1 hour; initialDelay staggers this behind the other hourly jobs so a cold start
    // does not run three scans at once. @SchedulerLock (issue #44 idiom) keeps a scaled-out
    // deployment from running the scan once per instance: lockAtMostFor is shorter than the
    // interval so a crashed instance frees the lock before the next run, lockAtLeastFor absorbs
    // clock skew between instances.
    @Scheduled(fixedRate = 3_600_000, initialDelay = 180_000)
    @SchedulerLock(name = "CoupleWinbackService_sendWinbackNudges",
            lockAtMostFor = "55m", lockAtLeastFor = "1m")
    public void sendWinbackNudges() {
        // Catches an AOP misconfiguration (missing proxy, self-invocation) that would silently
        // disable the lock. Unit tests call LockAssert.TestHelper.makeAllAssertsPass(true).
        LockAssert.assertLocked();
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();
        log.info("couple winback job started, runId={}", runId);
        try {
            int sent = 0;
            int suppressed = 0;
            int failed = 0;
            for (CoupleWinbackTouch touch : CoupleWinbackTouch.values()) {
                TouchOutcome outcome = sendTouch(runId, touch, now);
                sent += outcome.sent();
                suppressed += outcome.suppressed();
                failed += outcome.failed();
            }
            log.info("couple winback job finished, runId={}, sent={}, suppressed={}, failed={}, durationMs={}",
                    runId, sent, suppressed, failed, System.currentTimeMillis() - startMs);
        } catch (Exception ex) {
            log.error("couple winback job crashed, runId={}, durationMs={}",
                    runId, System.currentTimeMillis() - startMs, ex);
            throw ex;
        }
    }

    private TouchOutcome sendTouch(UUID runId, CoupleWinbackTouch touch, LocalDateTime now) {
        // A couple is due once "now" is at least daysAfterSignup past their signup, and stays due
        // for WINDOW_WIDTH_DAYS beyond that. Expressed as a signup-time window so the query seeks
        // an index on couples.created_at rather than computing an age per row.
        LocalDateTime signedUpUntil = now.minusDays(touch.daysAfterSignup());
        LocalDateTime signedUpFrom = signedUpUntil.minusDays(WINDOW_WIDTH_DAYS);

        List<CoupleWinbackCandidate> candidates = winbackRepository.findWinbackCandidates(
                touch, signedUpFrom, signedUpUntil, now.toLocalDate(), MAX_PER_TOUCH_PER_RUN);
        if (candidates.isEmpty()) {
            return new TouchOutcome(0, 0, 0);
        }

        int sent = 0;
        int suppressed = 0;
        int failed = 0;
        for (CoupleWinbackCandidate candidate : candidates) {
            if (isSuppressed(candidate)) {
                // No marker is written: we did not send, and claiming otherwise would be a lie in
                // the data. The bounded window stops the re-check from running forever.
                suppressed++;
                continue;
            }
            try {
                sender.send(candidate, touch);
                sent++;
            } catch (Exception ex) {
                // Per-item WARN and carry on: one couple's failure never aborts the batch. A
                // duplicate-marker violation lands here too, which is the correct outcome (the
                // nudge was already sent) and is rare enough not to warrant its own branch.
                failed++;
                log.warn("couple winback nudge failed, runId={}, coupleId={}, touch={}",
                        runId, candidate.coupleId(), touch, ex);
            }
        }
        log.info("couple winback touch processed, runId={}, touch={}, candidates={}, sent={}, suppressed={}, failed={}",
                runId, touch, candidates.size(), sent, suppressed, failed);
        return new TouchOutcome(sent, suppressed, failed);
    }

    // Win-back mail is couple-facing lifecycle marketing, so it honours exactly the unsubscribe
    // state the welcome mail does: the address-level (global) suppression set, fed by the footer
    // link, bounces, and spam complaints. Per-couple opt-outs are a guest-to-wedding relationship
    // and do not apply here, which is why this asks for the global check rather than passing a null
    // couple through the couple-scoped one.
    private boolean isSuppressed(CoupleWinbackCandidate candidate) {
        String email = candidate.email();
        if (email == null || email.isBlank()) return true;
        return suppressionService.isGloballySuppressed(EmailSuppressionService.emailHash(email));
    }

    private record TouchOutcome(int sent, int suppressed, int failed) {}
}
