package com.altarwed.application.service;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.port.VendorListingNudgeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The per-vendor transactional unit of the listing-completion nudge (issue #557).
 *
 * Deliberately a SEPARATE bean from {@link VendorListingNudgeService}: the receipt insert and
 * the outbox enqueue must commit together (a queued nudge is always recorded, and a recorded
 * nudge was always queued), while one vendor's failure must NOT roll back the rest of the batch.
 * A self-invoked @Transactional method on the scheduler bean would bypass the Spring proxy and
 * silently lose that per-vendor boundary, so the transactional work lives here where the
 * scheduler reaches it through a real proxy. Same split as CampaignReminderSender.
 */
@Service
public class VendorListingNudgeSender {

    private final AsyncEmailService asyncEmailService;
    private final VendorListingNudgeRepository nudgeRepository;
    private final String appBaseUrl;

    public VendorListingNudgeSender(
            AsyncEmailService asyncEmailService,
            VendorListingNudgeRepository nudgeRepository,
            // Same property (and same safe default) VendorAuthService already uses to build the
            // vendor dashboard link, so this introduces no new environment variable.
            @Value("${altarwed.app.base-url:https://app.altarwed.com}") String appBaseUrl) {
        this.asyncEmailService = asyncEmailService;
        this.nudgeRepository = nudgeRepository;
        this.appBaseUrl = appBaseUrl;
    }

    /**
     * Records the nudge receipt and enqueues the email in one transaction.
     *
     * The receipt is written FIRST so the unique-constraint race is decided before any payload
     * is serialised: a second instance attempting the same vendor fails here, its transaction
     * rolls back, and no outbox row survives. Ordering within the transaction does not change
     * atomicity, only how early the loser gives up.
     */
    @Transactional
    public void sendListingNudge(Vendor vendor, VendorListingNudgeService.ListingGaps gaps) {
        nudgeRepository.markSent(vendor.id());

        asyncEmailService.sendVendorListingNurtureEmail(
                vendor.email(),
                vendor.businessName(),
                appBaseUrl + "/dashboard",
                gaps.missingLogo(),
                gaps.missingBio(),
                gaps.missingPhotos());
    }
}
