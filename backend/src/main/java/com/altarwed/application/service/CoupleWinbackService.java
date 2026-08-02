package com.altarwed.application.service;

import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.CoupleWinbackTouchRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Couple win-back sequence (issue #551): the largest retention leak was that a couple who signs up
 * but never publishes their wedding website heard nothing after the welcome mail. Once per hour
 * this scheduler finds couples in the win-back age window and enqueues at most one warm nudge per
 * couple through the durable email outbox:
 *   - about 2 days after signup:  "your website is one step away" (link to the editor).
 *   - about 7 days after signup:  "3 things couples do first" (guest list, save the dates, seating).
 *   - about 21 days after signup: "your wedding page is waiting" (the FINAL touch).
 *
 * Each touch fires inside a small age window rather than a bare "older than N days" test, and each
 * window is disjoint, so a given signup age maps to at most one touch. The window (a few days wide)
 * absorbs the hourly cadence and a short outage, while its upper bound is what keeps a couple who
 * signed up long before this feature existed from being blasted with the whole sequence at once.
 * A couple older than the last window matches nothing, so the sequence simply ends: no infinite
 * nagging.
 *
 * Stop conditions, all honoured before a send:
 *   - published website  -> the couple already did the thing we are nudging toward, skip.
 *   - deleted account    -> isActive=false, excluded by the candidate query itself.
 *   - unsubscribed/bounced -> the suppression list, checked per couple.
 *   - already sent        -> the send-once ledger; a re-run or scale-out cannot double-send.
 *
 * The scheduler is intentionally NOT @Transactional (mirrors RsvpReminderService and
 * CampaignReminderService): each per-couple record-and-enqueue is its own committed unit of work in
 * {@link CoupleWinbackSender}, so one couple failing (a serialization error, or a losing race on the
 * unique (couple_id, touch) constraint) never rolls back the rest of the batch.
 *
 * Scale note: only couples inside the roughly three-week window are read each hour, and the
 * per-couple published/ledger lookups run over that bounded slice, never the whole couples table.
 * When volume demands it, fold the published and ledger checks into the candidate query as a join.
 */
@Service
public class CoupleWinbackService {

    private static final Logger log = LoggerFactory.getLogger(CoupleWinbackService.class);

    // Inclusive signup-age windows, in whole days since createdAt. Disjoint by construction so a
    // given age maps to at most one touch. Each window is three days wide to tolerate the hourly
    // cadence and a short outage without letting the touch slip by unremindered.
    static final int DAY_2_MIN = 2;
    static final int DAY_2_MAX = 4;
    static final int DAY_7_MIN = 7;
    static final int DAY_7_MAX = 9;
    static final int DAY_21_MIN = 21;
    static final int DAY_21_MAX = 23;

    // The candidate query only needs couples whose age can fall in some window: at least the
    // earliest lower bound, at most the latest upper bound. Older couples match nothing.
    static final int EARLIEST_AGE_DAYS = DAY_2_MIN;
    static final int LATEST_AGE_DAYS = DAY_21_MAX;

    private final CoupleRepository coupleRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final CoupleWinbackTouchRepository touchRepository;
    private final EmailSuppressionService suppressionService;
    private final CoupleWinbackSender sender;

    public CoupleWinbackService(CoupleRepository coupleRepository,
                                WeddingWebsiteRepository websiteRepository,
                                CoupleWinbackTouchRepository touchRepository,
                                EmailSuppressionService suppressionService,
                                CoupleWinbackSender sender) {
        this.coupleRepository = coupleRepository;
        this.websiteRepository = websiteRepository;
        this.touchRepository = touchRepository;
        this.suppressionService = suppressionService;
        this.sender = sender;
    }

    /**
     * Maps a whole-day signup age to the single touch whose window contains it, or empty when the
     * age is between windows or past the last one. Package-private so the scheduling math is unit
     * testable without any copy or I/O.
     */
    static Optional<CoupleWinbackTouch> touchForAge(long ageDays) {
        if (ageDays >= DAY_2_MIN && ageDays <= DAY_2_MAX) return Optional.of(CoupleWinbackTouch.DAY_2);
        if (ageDays >= DAY_7_MIN && ageDays <= DAY_7_MAX) return Optional.of(CoupleWinbackTouch.DAY_7);
        if (ageDays >= DAY_21_MIN && ageDays <= DAY_21_MAX) return Optional.of(CoupleWinbackTouch.DAY_21);
        return Optional.empty();
    }

    // fixedRate = 1 hour; initialDelay avoids a burst on startup. @SchedulerLock (issue #44 idiom)
    // keeps a scaled-out deployment from sending each touch once per instance in the same window:
    // lockAtMostFor is shorter than the interval so a crashed instance frees the lock before the
    // next run, lockAtLeastFor absorbs clock skew between instances. The unique (couple_id, touch)
    // constraint is the second line of defence behind the lock.
    @Scheduled(fixedRate = 3_600_000, initialDelay = 60_000)
    @SchedulerLock(name = "CoupleWinbackService_sendWinbackTouches",
            lockAtMostFor = "55m", lockAtLeastFor = "1m")
    public void sendWinbackTouches() {
        // Catches an AOP misconfiguration (missing proxy, self-invocation) that would silently
        // disable the lock. Unit tests call LockAssert.TestHelper.makeAllAssertsPass(true).
        LockAssert.assertLocked();
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();

        // Age >= EARLIEST means createdAt <= now - EARLIEST; age <= LATEST means createdAt >= now -
        // LATEST. The window is inclusive on both ends.
        LocalDateTime from = now.minusDays(LATEST_AGE_DAYS);
        LocalDateTime to = now.minusDays(EARLIEST_AGE_DAYS);
        List<Couple> candidates = coupleRepository.findActiveCreatedBetween(from, to);
        log.info("couple winback job started, runId={}, candidateCount={}", runId, candidates.size());

        int sent = 0;
        int notDue = 0;
        int published = 0;
        int suppressed = 0;
        int alreadySent = 0;
        int failed = 0;

        for (Couple couple : candidates) {
            long ageDays = ChronoUnit.DAYS.between(couple.createdAt(), now);
            Optional<CoupleWinbackTouch> due = touchForAge(ageDays);
            if (due.isEmpty()) {
                notDue++;
                continue;
            }
            CoupleWinbackTouch touch = due.get();

            // Stop condition: the couple already published, so the whole point of the nudge is done.
            if (hasPublishedWebsite(couple.id())) {
                published++;
                continue;
            }
            // Stop condition: unsubscribed or bounced/complained (global) or opted out. Mirrors the
            // welcome mail's suppression handling so an opt-out silences the whole sequence.
            if (suppressionService.isSuppressed(couple.id(), EmailSuppressionService.emailHash(couple.email()))) {
                suppressed++;
                continue;
            }
            // Dedupe: this touch already went out. The ledger check keeps the common case cheap; the
            // unique constraint in CoupleWinbackSender is the hard guarantee under a race.
            Set<CoupleWinbackTouch> alreadyDone = touchRepository.findSentTouches(couple.id());
            if (alreadyDone.contains(touch)) {
                alreadySent++;
                continue;
            }

            try {
                sender.sendTouch(couple, touch);
                sent++;
            } catch (Exception ex) {
                // Never let one couple abort the batch. A losing race on the unique constraint lands
                // here too and is correctly counted as not-sent (the winner sent it).
                failed++;
                log.warn("couple winback touch failed, runId={}, coupleId={}, touch={}",
                        runId, couple.id(), touch, ex);
            }
        }

        log.info("couple winback job finished, runId={}, sent={}, notDue={}, published={}, suppressed={}, alreadySent={}, failed={}, durationMs={}",
                runId, sent, notDue, published, suppressed, alreadySent, failed,
                System.currentTimeMillis() - startMs);
    }

    private boolean hasPublishedWebsite(UUID coupleId) {
        return websiteRepository.findByCoupleId(coupleId)
                .filter(WeddingWebsite::isPublished)
                .isPresent();
    }
}
