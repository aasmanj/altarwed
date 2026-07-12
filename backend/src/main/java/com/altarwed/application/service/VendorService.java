package com.altarwed.application.service;

import com.altarwed.application.dto.UpdateVendorRequest;
import com.altarwed.application.dto.VendorAnalyticsResponse;
import com.altarwed.application.dto.VendorPageResult;
import com.altarwed.application.dto.VendorStatsResponse;
import com.altarwed.domain.exception.AnalyticsNotEntitledException;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class VendorService {

    private static final Logger log = LoggerFactory.getLogger(VendorService.class);

    private final VendorRepository vendorRepository;
    private final InquiryRepository inquiryRepository;
    private final VendorPortfolioPhotoRepository portfolioPhotoRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final VendorSubscriptionRepository subscriptionRepository;
    private final BlobStoragePort blobStorage;
    private final AsyncEmailService asyncEmailService;
    private final String publicBaseUrl;
    private final String appBaseUrl;

    public VendorService(VendorRepository vendorRepository,
                         InquiryRepository inquiryRepository,
                         VendorPortfolioPhotoRepository portfolioPhotoRepository,
                         RefreshTokenRepository refreshTokenRepository,
                         VendorSubscriptionRepository subscriptionRepository,
                         BlobStoragePort blobStorage,
                         AsyncEmailService asyncEmailService,
                         @Value("${altarwed.nextjs.base-url:https://www.altarwed.com}") String publicBaseUrl,
                         @Value("${altarwed.app.base-url:https://app.altarwed.com}") String appBaseUrl) {
        this.vendorRepository = vendorRepository;
        this.inquiryRepository = inquiryRepository;
        this.portfolioPhotoRepository = portfolioPhotoRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.blobStorage = blobStorage;
        this.asyncEmailService = asyncEmailService;
        this.publicBaseUrl = publicBaseUrl;
        this.appBaseUrl = appBaseUrl;
    }

    @Transactional(readOnly = true)
    public Vendor getById(UUID id) {
        return vendorRepository.findById(id)
                .orElseThrow(() -> new VendorNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Vendor getByEmail(String email) {
        return vendorRepository.findByEmail(email)
                .orElseThrow(() -> new VendorNotFoundException(email));
    }

    @Transactional
    public Vendor update(UUID vendorId, UpdateVendorRequest req) {
        log.info("vendor listing update started, vendorId={}", vendorId);
        Vendor existing = getById(vendorId);
        Vendor updated = new Vendor(
                existing.id(),
                req.businessName()    != null ? req.businessName()    : existing.businessName(),
                req.category()        != null ? req.category()        : existing.category(),
                req.city()            != null ? req.city()            : existing.city(),
                req.state()           != null ? req.state()           : existing.state(),
                existing.email(),
                existing.passwordHash(),
                req.isChristianOwned()!= null ? req.isChristianOwned(): existing.isChristianOwned(),
                req.denominationIds() != null ? req.denominationIds() : existing.denominationIds(),
                existing.isActive(),
                existing.isVerified(),
                req.priceTier()       != null ? blankToNull(req.priceTier())       : existing.priceTier(),
                req.bio()             != null ? blankToNull(req.bio())             : existing.bio(),
                req.description()     != null ? blankToNull(req.description())     : existing.description(),
                req.websiteUrl()      != null ? blankToNull(req.websiteUrl())      : existing.websiteUrl(),
                req.phone()           != null ? blankToNull(req.phone())           : existing.phone(),
                existing.logoUrl(),
                existing.viewCount(),
                req.contactEmail()    != null ? blankToNull(req.contactEmail())    : existing.contactEmail(),
                existing.createdAt(),
                LocalDateTime.now()
        );
        Vendor saved = vendorRepository.save(updated);
        log.info("vendor listing updated, vendorId={}", vendorId);
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Vendor verify(UUID vendorId) {
        log.info("vendor verify started, vendorId={}", vendorId);
        Vendor existing = getById(vendorId);
        if (existing.isVerified()) {
            // Idempotency guard: re-verifying an already-live vendor (admin double-click,
            // promo redeem after admin approval) must not send a duplicate "you're live" email.
            log.info("vendor already verified, no-op, vendorId={}", vendorId);
            return existing;
        }
        Vendor saved = vendorRepository.save(existing.withVerified());
        log.info("vendor verified, vendorId={}", vendorId);
        // @Async has no transaction awareness -- dispatching sendVendorVerifiedEmail() directly
        // races the REQUIRES_NEW commit and can fire before the row is visible on other
        // connections. afterCommit() guarantees the email queues only after this transaction
        // commits, so the public listing URL in the email is live when the vendor clicks it.
        String listingUrl   = publicBaseUrl + "/vendors/" + saved.id();
        String dashboardUrl = appBaseUrl + "/dashboard";
        String vendorEmail     = saved.email();
        String vendorBizName   = saved.businessName();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                asyncEmailService.sendVendorVerifiedEmail(vendorEmail, vendorBizName, listingUrl, dashboardUrl);
                log.info("vendor verified email queued, vendorId={}", vendorId);
            }
        });
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Vendor unverify(UUID vendorId) {
        log.info("vendor unverify started, vendorId={}", vendorId);
        Vendor saved = vendorRepository.save(getById(vendorId).withUnverified());
        log.info("vendor unverified, vendorId={}", vendorId);
        return saved;
    }

    // Vendor-initiated pause/resume of their own listing (toggles isActive). Paused vendors drop
    // out of the public directory and stop receiving new inquiries; their subscription/verification
    // and account are untouched, so they can resume any time.
    @Transactional
    public Vendor setListingActive(UUID vendorId, boolean active) {
        Vendor saved = vendorRepository.save(getById(vendorId).withListingActive(active));
        log.info("vendor listing {}, vendorId={}", active ? "resumed" : "paused", vendorId);
        return saved;
    }

    @Transactional
    public Vendor updateLogoUrl(UUID vendorId, String logoUrl) {
        // Capture the prior logo URL so its blob can be cleaned up on replace (issue #101: a new logo
        // upload otherwise leaks the old blob in storage forever, growing cost unbounded at scale).
        Vendor existing = getById(vendorId);
        String oldLogoUrl = existing.logoUrl();
        Vendor saved = vendorRepository.save(existing.withLogoUrl(logoUrl));
        log.info("vendor logo updated, vendorId={}", vendorId);

        // Delete the replaced blob only AFTER this transaction commits, mirroring deleteVendor: the
        // delete is irreversible, so running it inside the transaction would risk deleting the old
        // blob for an update that a commit-time failure then rolls back (leaving the row pointing at a
        // deleted blob). With no active transaction (e.g. a direct unit-test call) fall back to inline.
        List<String> oldBlobs = oldLogoUrl == null ? List.of() : List.of(oldLogoUrl);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteBlobsBestEffort(vendorId, oldBlobs);
                }
            });
        } else {
            deleteBlobsBestEffort(vendorId, oldBlobs);
        }
        return saved;
    }

    @Transactional
    public void incrementViewCount(UUID vendorId) {
        vendorRepository.incrementViewCount(vendorId);
        log.debug("vendor view count incremented, vendorId={}", vendorId);
    }

    // Free-tier stats: the lifetime view count every vendor may see, plus whether this vendor is
    // entitled to the gated Pro analytics (so the dashboard can render either the real numbers or an
    // upgrade prompt). Inquiry analytics are deliberately NOT returned here; they were previously
    // given away free (issue #371) and now live behind getAnalytics.
    @Transactional(readOnly = true)
    public VendorStatsResponse getStats(UUID vendorId) {
        Vendor vendor = getById(vendorId);
        boolean proAnalytics = hasProAnalyticsAccess(vendorId);
        return new VendorStatsResponse(vendor.viewCount() != null ? vendor.viewCount() : 0, proAnalytics);
    }

    // Pro-only analytics: inquiry totals on top of the view count. The entitlement is enforced HERE,
    // server-side, so a crafted request from a non-Pro vendor cannot read the paid data even if the
    // frontend gate is bypassed. A non-entitled caller gets AnalyticsNotEntitledException (403).
    @Transactional(readOnly = true)
    public VendorAnalyticsResponse getAnalytics(UUID vendorId) {
        Vendor vendor = getById(vendorId);
        if (!hasProAnalyticsAccess(vendorId)) {
            // Expected paywall rejection, not an error: WARN (not ERROR) so it never pages on-call.
            log.warn("vendor analytics access denied, no active pro subscription, vendorId={}", vendorId);
            throw new AnalyticsNotEntitledException(vendorId);
        }
        long totalInquiries = inquiryRepository.countByVendorId(vendorId);
        long unreadInquiries = inquiryRepository.countUnreadByVendorId(vendorId);
        log.info("vendor analytics served, vendorId={}", vendorId);
        return new VendorAnalyticsResponse(
                vendor.viewCount() != null ? vendor.viewCount() : 0, totalInquiries, unreadInquiries);
    }

    // A vendor is entitled to Pro analytics when their subscription is ACTIVE (paid Pro or comped).
    // No subscription row, or a PENDING/PAST_DUE/CANCELLED/TRIALING one, is not entitled. The
    // ACTIVE-only rule lives on the domain record (VendorSubscription.hasProAnalyticsAccess).
    private boolean hasProAnalyticsAccess(UUID vendorId) {
        return subscriptionRepository.findByVendorId(vendorId)
                .map(VendorSubscription::hasProAnalyticsAccess)
                .orElse(false);
    }

    @Transactional
    public void deleteVendor(UUID vendorId) {
        log.info("vendor hard delete started, vendorId={}", vendorId);
        Vendor vendor = getById(vendorId);

        // Capture blob URLs before the row delete. The DB cascade removes the
        // vendor_portfolio_photos rows and the vendors row (which holds logo_url),
        // but the blob objects live in Azure Storage, not the database, so without
        // explicit cleanup they would leak in storage forever.
        List<String> blobUrls = new ArrayList<>();
        if (vendor.logoUrl() != null) {
            blobUrls.add(vendor.logoUrl());
        }
        portfolioPhotoRepository.findAllByVendorId(vendorId)
                .forEach(photo -> blobUrls.add(photo.photoUrl()));

        // inquiries has no ON DELETE CASCADE, so it must be removed before the vendor row.
        inquiryRepository.deleteByVendorId(vendorId);
        // Revoke refresh tokens so a deleted vendor cannot mint fresh access tokens
        // until natural expiry. A vendor's refresh-token userId is its own id().
        refreshTokenRepository.deleteAllByUserId(vendorId);
        vendorRepository.deleteById(vendorId);

        // Delete the blobs only AFTER the row deletes commit. blobStorage.delete is an
        // irreversible external call that rethrows on failure; running it inside the
        // transaction would both hold the DB connection across Azure round-trips and,
        // worse, risk deleting blobs for rows that a commit-time failure then rolls back
        // (leaving surviving rows pointing at deleted blobs). With no active transaction
        // (e.g. a direct unit-test call) fall back to inline cleanup.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteBlobsBestEffort(vendorId, blobUrls);
                }
            });
        } else {
            deleteBlobsBestEffort(vendorId, blobUrls);
        }
        log.info("vendor hard deleted, vendorId={}, blobs={}", vendorId, blobUrls.size());
    }

    // Best-effort, isolated per blob: one storage failure must not block the others. A failure leaves
    // a recoverable, logged orphan, far better than failing an already-committed change over a
    // transient storage error. Shared by the hard-delete and logo-replace paths. WARN not ERROR: a
    // tolerated per-item cleanup failure, not an on-call page.
    private void deleteBlobsBestEffort(UUID vendorId, List<String> blobUrls) {
        for (String url : blobUrls) {
            try {
                blobStorage.delete(url);
            } catch (RuntimeException ex) {
                log.warn("vendor blob orphaned, delete failed (best-effort, ignoring), vendorId={}, url={}", vendorId, url, ex);
            }
        }
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    // Hard upper bound on a single page so an unauthenticated caller can never request an
    // arbitrarily large slice; the candidate set is itself capped at MAX_SEARCH_RESULTS.
    public static final int MAX_PAGE_SIZE = 50;

    /**
     * Paginated public directory query. The price-tier filter, the sort, and the page slice all
     * run in the database (issue #135): the service asks the repository for the total match count
     * and just the requested page, rather than pulling a name-ordered 100-row prefix and then
     * sorting/filtering/paging it in memory. That earlier approach silently corrupted the
     * directory past 100 matches (a popular vendor sorting after position 100 never surfaced in
     * the default sort, and tier totals were bounded by the 100-row prefix). Returns the page plus
     * the total so the UI can render "Showing N of M" and prev/next controls.
     *
     * @param sort "name" for alphabetical A-Z; anything else (or null) uses the default
     *             popularity order (most-viewed first), a lightweight relevance proxy.
     */
    @Transactional(readOnly = true)
    public VendorPageResult getVendors(VendorCategory category, String city, String priceTier,
                                       String sort, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        // Full match count from the database (a COUNT, no rows streamed), then capped at
        // MAX_SEARCH_RESULTS: the public directory never advertises, or lets an unauthenticated
        // caller page past, the first 100 matches (egress / DoS bound). Capping here (not by
        // truncating a candidate list) is what keeps the tier total correct: it is the real count
        // of all tier matches, only clamped at the cap, not bounded by a 100-row name prefix.
        long matchCount = vendorRepository.countDirectory(category, city, priceTier);
        int total = (int) Math.min(matchCount, VendorRepository.MAX_SEARCH_RESULTS);

        // Long arithmetic guards against int overflow on a hostile page value before clamping.
        long offset = (long) safePage * safeSize;
        List<Vendor> pageItems;
        if (offset >= total) {
            // Past the last in-window row (or past the 100-row cap): empty slice, real total. No
            // query is issued, so a caller cannot page deep into the table to enumerate it.
            pageItems = List.of();
        } else {
            List<Vendor> fetched =
                    vendorRepository.findDirectoryPage(category, city, priceTier, sort, safePage, safeSize);
            // Trim the boundary page so no row beyond position MAX_SEARCH_RESULTS is ever returned:
            // once the real match count exceeds the cap, the DB page may spill past the window, but
            // the directory's hard upper bound stays 100 rows across all pages.
            int windowRemaining = total - (int) offset;
            pageItems = fetched.size() > windowRemaining
                    ? List.copyOf(fetched.subList(0, windowRemaining))
                    : List.copyOf(fetched);
        }
        log.debug("vendor directory queried, total={}, page={}, size={}, returned={}",
                total, safePage, safeSize, pageItems.size());
        return new VendorPageResult(pageItems, total);
    }
}
