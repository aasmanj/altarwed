package com.altarwed.application.service;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.domain.port.VendorListingNudgeRepository;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * One-time vendor listing-completion nudge (issue #557).
 *
 * VENDOR_WELCOME fires at registration and VENDOR_VERIFIED when the listing goes live, but
 * nothing prompted a vendor to add the assets couples actually judge a listing on: a logo, a
 * bio, and portfolio photos. A listing without them converts poorly, which is the value the
 * founding-25 cohort is supposed to feel. This job sends exactly one nudge per vendor, on or
 * after day 3 after registration, and only while the listing is still incomplete.
 *
 * Three independent layers keep it to "one email, ever":
 *   1. the candidate query excludes vendors that already have a receipt (cheap, set-based);
 *   2. {@link #sendNudges()} re-checks the receipt per vendor (defends against a stale read
 *      inside a long run, and is the layer a unit test can drive);
 *   3. the UNIQUE constraint on vendor_listing_nudge_sends.vendor_id is the hard guarantee: two
 *      scaled-out instances racing on the same vendor both insert, exactly one commits, and the
 *      loser's transaction rolls back with its outbox row.
 *
 * The scheduler is deliberately NOT @Transactional (same shape as CampaignReminderService and
 * RsvpReminderService): each per-vendor enqueue-and-record is its own committed unit of work in
 * {@link VendorListingNudgeSender}, reached through a real Spring proxy, so one vendor failing
 * never rolls back the rest of the batch.
 *
 * Blast-radius note: there is no upper age bound, so vendors who registered long before this
 * shipped are eligible and will each get their one nudge. BATCH_LIMIT caps a single run, so a
 * back catalogue drains over several days rather than firing thousands of emails in one burst
 * (which would put the shared altarwed.com sending reputation at risk).
 */
@Service
public class VendorListingNudgeService {

    private static final Logger log = LoggerFactory.getLogger(VendorListingNudgeService.class);

    // The day-3 trigger from the issue. A vendor is eligible once their registration is at least
    // this old, giving them a few days to finish the listing on their own before we nudge.
    static final int NUDGE_AFTER_DAYS = 3;

    // Vendors processed per run. Bounds the per-run email burst and the query cost; the
    // remainder is picked up on the next daily run.
    static final int BATCH_LIMIT = 100;

    private final VendorRepository vendorRepository;
    private final VendorPortfolioPhotoRepository photoRepository;
    private final VendorListingNudgeRepository nudgeRepository;
    private final EmailSuppressionPort suppressionPort;
    private final VendorListingNudgeSender sender;

    public VendorListingNudgeService(VendorRepository vendorRepository,
                                     VendorPortfolioPhotoRepository photoRepository,
                                     VendorListingNudgeRepository nudgeRepository,
                                     EmailSuppressionPort suppressionPort,
                                     VendorListingNudgeSender sender) {
        this.vendorRepository = vendorRepository;
        this.photoRepository = photoRepository;
        this.nudgeRepository = nudgeRepository;
        this.suppressionPort = suppressionPort;
        this.sender = sender;
    }

    // Daily at 03:15 UTC is the right cadence for a day-3 nudge: the trigger has a one-day
    // resolution, so polling more often would only re-scan the same candidate set. A cron
    // expression avoids the fixedRate hazard where every App Service restart fires an extra
    // run 5 minutes later (which would double-attempt the batch mid-day). lockAtLeastFor=23h
    // prevents a second instance from picking up the lock immediately after a crash recovery
    // within the same 24-hour window. @SchedulerLock (issue #44 idiom) stops a scaled-out
    // deployment from running the scan once per instance; lockAtMostFor is a crash safety
    // net well under the interval, and correctness does not depend on it because the unique
    // constraint is the real dedup guarantee.
    @Scheduled(cron = "0 15 3 * * *", zone = "UTC")
    @SchedulerLock(name = "VendorListingNudgeService_sendNudges",
            lockAtMostFor = "20m", lockAtLeastFor = "23h")
    public void sendNudges() {
        // Catches an AOP misconfiguration (missing proxy, self-invocation) that would silently
        // disable the lock. Unit tests call LockAssert.TestHelper.makeAllAssertsPass(true).
        LockAssert.assertLocked();
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(NUDGE_AFTER_DAYS);
            List<Vendor> candidates = vendorRepository.findListingNudgeCandidates(cutoff, BATCH_LIMIT);
            log.info("vendor listing nudge job started, runId={}, candidateCount={}", runId, candidates.size());

            int sent = 0;
            int skipped = 0;
            int suppressed = 0;
            int failed = 0;
            for (Vendor vendor : candidates) {
                if (nudgeRepository.existsByVendorId(vendor.id())) {
                    skipped++;
                    continue;
                }
                ListingGaps gaps = gapsFor(vendor);
                if (!gaps.anyMissing()) {
                    // Completed their listing between the query and now: nothing to nudge about.
                    skipped++;
                    continue;
                }
                if (isSuppressed(vendor.email())) {
                    // Bounced or complained before. Write the receipt so this vendor is removed
                    // from the candidate set and does not consume a BATCH_LIMIT slot on every
                    // future run. Global suppression is permanent (bounce/complaint list); the
                    // vendor can re-engage via a fresh registration if the address is cleared.
                    nudgeRepository.markSent(vendor.id());
                    suppressed++;
                    continue;
                }
                try {
                    sender.sendListingNudge(vendor, gaps);
                    sent++;
                } catch (Exception ex) {
                    failed++;
                    log.warn("vendor listing nudge failed, runId={}, vendorId={}", runId, vendor.id(), ex);
                }
            }

            log.info("vendor listing nudge job finished, runId={}, sent={}, skipped={}, suppressed={}, "
                            + "failed={}, durationMs={}",
                    runId, sent, skipped, suppressed, failed, System.currentTimeMillis() - startMs);
        } catch (Exception ex) {
            log.error("vendor listing nudge job crashed, runId={}, durationMs={}",
                    runId, System.currentTimeMillis() - startMs, ex);
            throw ex;
        }
    }

    /**
     * The authoritative incompleteness check, measured on the freshly loaded vendor row.
     * VendorJpaRepository.findListingNudgeCandidates mirrors it as a set-based pre-filter; this
     * is the one that decides, so a vendor who finished their listing since the query ran is
     * skipped rather than nudged about gaps they no longer have.
     *
     * description is intentionally NOT part of the predicate: the issue scopes the nudge to
     * logo, bio, and photos, and adding a fourth gate would nudge vendors who are, for the
     * purpose of converting couples, already presentable.
     */
    private ListingGaps gapsFor(Vendor vendor) {
        boolean missingLogo = isBlank(vendor.logoUrl());
        boolean missingBio = isBlank(vendor.bio());
        boolean missingPhotos = photoRepository.countByVendorId(vendor.id()) == 0;
        return new ListingGaps(missingLogo, missingBio, missingPhotos);
    }

    // Global, address-level suppression only (bounce/complaint or a prior unsubscribe). There is
    // no couple context on vendor mail, so the per-couple opt-out table does not apply. The
    // adapter re-checks this on the way out via postMarketingEmail; this pre-check just avoids
    // writing an outbox row that would be dropped.
    private boolean isSuppressed(String email) {
        if (email == null || email.isBlank()) return true;
        return suppressionPort.isSuppressed(EmailSuppressionService.emailHash(email));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /**
     * Which listing assets a vendor is still missing, measured once so the send and the email
     * checklist agree. Primitives (not boxed) are correct here: this never crosses a JSON
     * boundary, every field is always computed, and "absent" is not a meaningful state.
     */
    public record ListingGaps(boolean missingLogo, boolean missingBio, boolean missingPhotos) {
        public boolean anyMissing() {
            return missingLogo || missingBio || missingPhotos;
        }
    }
}
