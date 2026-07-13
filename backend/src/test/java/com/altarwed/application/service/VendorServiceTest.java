package com.altarwed.application.service;

import com.altarwed.application.dto.VendorAnalyticsResponse;
import com.altarwed.application.dto.VendorPageResult;
import com.altarwed.application.dto.VendorStatsResponse;
import com.altarwed.domain.exception.AnalyticsNotEntitledException;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.model.VendorPortfolioPhoto;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link VendorService#deleteVendor}, the admin hard-delete path.
 * Covers the data-integrity guarantees the DB cascade does not give us: blob
 * cleanup (logo + portfolio), refresh-token revocation, best-effort isolation of
 * storage failures, and a clean no-op when the vendor does not exist.
 */
@ExtendWith(MockitoExtension.class)
class VendorServiceTest {

    @Mock private VendorRepository vendorRepository;
    @Mock private InquiryRepository inquiryRepository;
    @Mock private VendorPortfolioPhotoRepository portfolioPhotoRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private VendorSubscriptionRepository subscriptionRepository;
    @Mock private BlobStoragePort blobStorage;

    @InjectMocks private VendorService vendorService;

    @Test
    void deleteVendor_removesInquiriesRevokesTokensDeletesRowAndBlobs() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendorWithLogo(vendorId, "https://cdn/logo.jpg")));
        when(portfolioPhotoRepository.findAllByVendorId(vendorId)).thenReturn(List.of(
                photo(vendorId, "https://cdn/p1.jpg"),
                photo(vendorId, "https://cdn/p2.jpg")
        ));

        vendorService.deleteVendor(vendorId);

        // inquiries has no DB cascade, so it must be deleted before the vendor row.
        InOrder ordered = inOrder(inquiryRepository, refreshTokenRepository, vendorRepository);
        ordered.verify(inquiryRepository).deleteByVendorId(vendorId);
        ordered.verify(refreshTokenRepository).deleteAllByUserId(vendorId);
        ordered.verify(vendorRepository).deleteById(vendorId);
        verify(blobStorage).delete("https://cdn/logo.jpg");
        verify(blobStorage).delete("https://cdn/p1.jpg");
        verify(blobStorage).delete("https://cdn/p2.jpg");
    }

    @Test
    void deleteVendor_isBestEffortWhenABlobDeleteFails() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendorWithLogo(vendorId, "https://cdn/logo.jpg")));
        when(portfolioPhotoRepository.findAllByVendorId(vendorId)).thenReturn(List.of(photo(vendorId, "https://cdn/p1.jpg")));
        // A transient storage error on one blob must not abort the row deletes or the other blobs.
        doThrow(new RuntimeException("storage 500")).when(blobStorage).delete("https://cdn/logo.jpg");

        vendorService.deleteVendor(vendorId);

        verify(vendorRepository).deleteById(vendorId);
        verify(blobStorage).delete("https://cdn/p1.jpg");
    }

    @Test
    void deleteVendor_throwsAndTouchesNothingWhenVendorMissing() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vendorService.deleteVendor(vendorId))
                .isInstanceOf(VendorNotFoundException.class);

        verify(inquiryRepository, never()).deleteByVendorId(vendorId);
        verify(refreshTokenRepository, never()).deleteAllByUserId(vendorId);
        verify(vendorRepository, never()).deleteById(vendorId);
        verify(portfolioPhotoRepository, never()).findAllByVendorId(vendorId);
        verify(blobStorage, never()).delete(anyString());
    }

    @Test
    void setListingActive_pausesWithoutTouchingVerification() {
        UUID vendorId = UUID.randomUUID();
        // Helper builds a vendor with isActive=true, isVerified=true.
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendorWithLogo(vendorId, null)));
        when(vendorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Vendor paused = vendorService.setListingActive(vendorId, false);

        assertThat(paused.isActive()).isFalse();
        // Pausing must not disturb subscription/verification state.
        assertThat(paused.isVerified()).isTrue();
    }

    // -------------------------------------------------------------------------
    // updateLogoUrl: replace-cleanup of the prior logo blob (issue #149 / #101)
    //
    // Every "Change logo" persists a new blob under a fresh random name, so the old blob would
    // leak in storage forever unless it is deleted. updateLogoUrl captures the prior URL before
    // the save and drops that blob (best-effort) once the new URL is persisted. In these unit
    // tests no transaction synchronization is active, so the cleanup runs inline rather than on
    // afterCommit, letting us assert the delete directly.
    // -------------------------------------------------------------------------

    @Test
    void updateLogoUrl_replacingLogoDeletesOnlyTheOldBlob() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithLogo(vendorId, "https://cdn/old-logo.jpg")));
        when(vendorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Vendor saved = vendorService.updateLogoUrl(vendorId, "https://cdn/new-logo.jpg");

        // The new URL is persisted and the old blob is deleted, so exactly one logo blob survives.
        assertThat(saved.logoUrl()).isEqualTo("https://cdn/new-logo.jpg");
        verify(blobStorage).delete("https://cdn/old-logo.jpg");
        // The just-uploaded blob must never be deleted; the request still depends on it.
        verify(blobStorage, never()).delete("https://cdn/new-logo.jpg");
    }

    @Test
    void updateLogoUrl_firstLogoUploadDeletesNothing() {
        UUID vendorId = UUID.randomUUID();
        // Vendor has no prior logo (null): there is no old blob to clean up.
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithLogo(vendorId, null)));
        when(vendorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Vendor saved = vendorService.updateLogoUrl(vendorId, "https://cdn/first-logo.jpg");

        assertThat(saved.logoUrl()).isEqualTo("https://cdn/first-logo.jpg");
        verify(blobStorage, never()).delete(anyString());
    }

    @Test
    void updateLogoUrl_isBestEffortWhenOldBlobDeleteFails() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithLogo(vendorId, "https://cdn/old-logo.jpg")));
        when(vendorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // A transient storage error deleting the old blob must not fail an upload whose new URL
        // has already been persisted; the orphan is logged and tolerated instead.
        doThrow(new RuntimeException("storage 500")).when(blobStorage).delete("https://cdn/old-logo.jpg");

        Vendor saved = vendorService.updateLogoUrl(vendorId, "https://cdn/new-logo.jpg");

        assertThat(saved.logoUrl()).isEqualTo("https://cdn/new-logo.jpg");
        verify(vendorRepository).save(any());
        verify(blobStorage).delete("https://cdn/old-logo.jpg");
    }

    // -------------------------------------------------------------------------
    // getVendors: DB-side filter + sort + paging, cap, and total (issue #135)
    //
    // Sort and price-tier filtering now happen in the database, so these tests assert the
    // service's plumbing: it reports the DB match count (capped), forwards the sort/filter/page
    // to the repository unchanged, keeps the page cap, and never lets a caller page past the
    // MAX_SEARCH_RESULTS window. The end-to-end proof that a most-viewed vendor sorting after
    // position 100 actually surfaces (and that tier totals are correct past 100) lives in the
    // SQL Server-backed VendorDirectoryQueryTest, which exercises the real ORDER BY / OFFSET.
    // -------------------------------------------------------------------------

    @Test
    void getVendors_reportsDbCountAndReturnsRequestedPage() {
        // 25 matches: page 0 (size 20) returns the DB's first 20 rows, page 1 the remaining 5;
        // total is the DB COUNT (25) on both pages, not the size of any in-memory candidate set.
        when(vendorRepository.countDirectory(null, null, null)).thenReturn(25L);
        when(vendorRepository.findDirectoryPage(null, null, null, "name", 0, 20)).thenReturn(namedVendors(20));
        when(vendorRepository.findDirectoryPage(null, null, null, "name", 1, 20)).thenReturn(namedVendors(5));

        VendorPageResult page0 = vendorService.getVendors(null, null, null, "name", 0, 20);
        assertThat(page0.vendors()).hasSize(20);
        assertThat(page0.total()).isEqualTo(25);

        VendorPageResult page1 = vendorService.getVendors(null, null, null, "name", 1, 20);
        assertThat(page1.vendors()).hasSize(5);
        assertThat(page1.total()).isEqualTo(25);
    }

    @Test
    void getVendors_clampsPageSizeToFiftyBeforeQuerying() {
        when(vendorRepository.countDirectory(null, null, null)).thenReturn(60L);
        // The stub only matches size=50; if the service forwarded the raw size=1000 the stub would
        // not match and the page would come back empty, failing the assertion below.
        when(vendorRepository.findDirectoryPage(null, null, null, null, 0, VendorService.MAX_PAGE_SIZE))
                .thenReturn(namedVendors(VendorService.MAX_PAGE_SIZE));

        VendorPageResult result = vendorService.getVendors(null, null, null, null, 0, 1000);

        assertThat(result.vendors()).hasSize(VendorService.MAX_PAGE_SIZE);
        assertThat(result.total()).isEqualTo(60);
        verify(vendorRepository).findDirectoryPage(null, null, null, null, 0, VendorService.MAX_PAGE_SIZE);
    }

    @Test
    void getVendors_overpagedRequest_returnsEmptyWithoutQueryingRows() {
        when(vendorRepository.countDirectory(null, null, null)).thenReturn(3L);

        // page 9 (offset 180) is past the end: empty slice, real total, and no row query is issued
        // so a caller cannot page deep into the table to enumerate it.
        VendorPageResult result = vendorService.getVendors(null, null, null, "name", 9, 20);

        assertThat(result.vendors()).isEmpty();
        assertThat(result.total()).isEqualTo(3);
        verify(vendorRepository, never()).findDirectoryPage(any(), any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void getVendors_negativePageClampedToZero() {
        when(vendorRepository.countDirectory(null, null, null)).thenReturn(10L);
        when(vendorRepository.findDirectoryPage(null, null, null, "name", 0, 20)).thenReturn(namedVendors(10));

        VendorPageResult result = vendorService.getVendors(null, null, null, "name", -3, 20);

        assertThat(result.vendors()).hasSize(10);
        verify(vendorRepository).findDirectoryPage(null, null, null, "name", 0, 20);
    }

    @Test
    void getVendors_forwardsCategoryCityPriceTierAndSortToRepository() {
        when(vendorRepository.countDirectory(VendorCategory.FLORIST, "Austin", "$$")).thenReturn(2L);
        when(vendorRepository.findDirectoryPage(VendorCategory.FLORIST, "Austin", "$$", "name", 0, 20))
                .thenReturn(namedVendors(2));

        VendorPageResult result =
                vendorService.getVendors(VendorCategory.FLORIST, "Austin", "$$", "name", 0, 20);

        assertThat(result.total()).isEqualTo(2);
        // The tier filter AND the sort are server-side: the service forwards both to the DB query
        // unchanged rather than post-processing a candidate set in memory.
        verify(vendorRepository).countDirectory(VendorCategory.FLORIST, "Austin", "$$");
        verify(vendorRepository).findDirectoryPage(VendorCategory.FLORIST, "Austin", "$$", "name", 0, 20);
    }

    @Test
    void getVendors_capsReportedTotalAtMaxSearchResults() {
        // Even when the DB reports more matches than the directory cap, the reported total never
        // exceeds it (egress / DoS bound). This is the correct-total path: the count is real,
        // only clamped at the cap, never bounded by a 100-row name prefix.
        when(vendorRepository.countDirectory(null, null, "$$"))
                .thenReturn((long) VendorRepository.MAX_SEARCH_RESULTS + 30);
        when(vendorRepository.findDirectoryPage(null, null, "$$", "name", 0, 20)).thenReturn(namedVendors(20));

        VendorPageResult result = vendorService.getVendors(null, null, "$$", "name", 0, 20);

        assertThat(result.total()).isEqualTo(VendorRepository.MAX_SEARCH_RESULTS);
    }

    @Test
    void getVendors_trimsBoundaryPageToStayWithinCap() {
        // 130 real matches, so the reported total is capped at 100. A size-40 page 2 sits at
        // offset 80: the DB legitimately returns 40 rows (80..119), but only 20 of them are inside
        // the 100-row window, so the page is trimmed to 20. No row beyond position 100 is exposed.
        when(vendorRepository.countDirectory(null, null, null))
                .thenReturn((long) VendorRepository.MAX_SEARCH_RESULTS + 30);
        when(vendorRepository.findDirectoryPage(null, null, null, null, 2, 40)).thenReturn(namedVendors(40));

        VendorPageResult result = vendorService.getVendors(null, null, null, null, 2, 40);

        assertThat(result.vendors()).hasSize(20);
        assertThat(result.total()).isEqualTo(VendorRepository.MAX_SEARCH_RESULTS);
    }

    // -------------------------------------------------------------------------
    // Analytics gating: inquiry analytics are Pro-only (issue #371)
    //
    // Before this change /me/stats handed every vendor viewCount + inquiryCount, giving away the
    // exact thing the Pro upgrade panel sells. getStats now returns only the lifetime view count
    // plus an entitlement flag, and the inquiry analytics move to getAnalytics, which enforces the
    // paywall server-side: a non-Pro vendor is denied (AnalyticsNotEntitledException -> 402) and
    // never reads the inquiry counts, while a Pro (ACTIVE paid/comped, or TRIALING) vendor is allowed.
    // -------------------------------------------------------------------------

    @Test
    void getAnalytics_deniesVendorWithNoSubscription() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendorWithLogo(vendorId, null)));
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vendorService.getAnalytics(vendorId))
                .isInstanceOf(AnalyticsNotEntitledException.class);

        // The paid data must never be read for a non-entitled caller.
        verify(inquiryRepository, never()).countByVendorId(vendorId);
        verify(inquiryRepository, never()).countUnreadByVendorId(vendorId);
    }

    @Test
    void getAnalytics_deniesPastDueVendor() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendorWithLogo(vendorId, null)));
        // A lapsed (PAST_DUE) subscription is not entitled: the vendor stopped paying.
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, SubscriptionStatus.PAST_DUE, "sub_123")));

        assertThatThrownBy(() -> vendorService.getAnalytics(vendorId))
                .isInstanceOf(AnalyticsNotEntitledException.class);

        verify(inquiryRepository, never()).countByVendorId(vendorId);
    }

    @Test
    void getAnalytics_allowsPaidProVendorAndReturnsInquiryCounts() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithViews(vendorId, 42)));
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, SubscriptionStatus.ACTIVE, "sub_123")));
        when(inquiryRepository.countByVendorId(vendorId)).thenReturn(7L);
        when(inquiryRepository.countUnreadByVendorId(vendorId)).thenReturn(3L);

        VendorAnalyticsResponse analytics = vendorService.getAnalytics(vendorId);

        assertThat(analytics.viewCount()).isEqualTo(42);
        assertThat(analytics.inquiryCount()).isEqualTo(7L);
        assertThat(analytics.unreadInquiryCount()).isEqualTo(3L);
    }

    @Test
    void getAnalytics_allowsCompedVendorWithNoStripeSubscription() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithViews(vendorId, 5)));
        // Comped: ACTIVE subscription with no Stripe subscription id (granted by promo). Entitled.
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, SubscriptionStatus.ACTIVE, null)));
        when(inquiryRepository.countByVendorId(vendorId)).thenReturn(2L);
        when(inquiryRepository.countUnreadByVendorId(vendorId)).thenReturn(0L);

        VendorAnalyticsResponse analytics = vendorService.getAnalytics(vendorId);

        assertThat(analytics.inquiryCount()).isEqualTo(2L);
        assertThat(analytics.unreadInquiryCount()).isEqualTo(0L);
    }

    @Test
    void getAnalytics_allowsTrialingVendor() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithViews(vendorId, 11)));
        // TRIALING: a vendor in a Stripe trial is entitled, matching StripeService which treats
        // ACTIVE and TRIALING as equivalent, and letting the trial show the analytics it is selling.
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, SubscriptionStatus.TRIALING, "sub_123")));
        when(inquiryRepository.countByVendorId(vendorId)).thenReturn(4L);
        when(inquiryRepository.countUnreadByVendorId(vendorId)).thenReturn(1L);

        VendorAnalyticsResponse analytics = vendorService.getAnalytics(vendorId);

        assertThat(analytics.inquiryCount()).isEqualTo(4L);
        assertThat(analytics.unreadInquiryCount()).isEqualTo(1L);
    }

    @Test
    void getStats_returnsLifetimeViewsAndEntitlementFlagWithoutInquiryData() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithViews(vendorId, 13)));
        // Non-Pro: no subscription row.
        when(subscriptionRepository.findByVendorId(vendorId)).thenReturn(Optional.empty());

        VendorStatsResponse stats = vendorService.getStats(vendorId);

        assertThat(stats.viewCount()).isEqualTo(13);
        assertThat(stats.proAnalytics()).isFalse();
        // Free-tier stats must never touch the inquiry counts (issue #371).
        verify(inquiryRepository, never()).countByVendorId(vendorId);
        verify(inquiryRepository, never()).countUnreadByVendorId(vendorId);
    }

    @Test
    void getStats_flagsProAnalyticsTrueForActiveSubscriber() {
        UUID vendorId = UUID.randomUUID();
        when(vendorRepository.findById(vendorId))
                .thenReturn(Optional.of(vendorWithViews(vendorId, 0)));
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, SubscriptionStatus.ACTIVE, "sub_123")));

        VendorStatsResponse stats = vendorService.getStats(vendorId);

        assertThat(stats.proAnalytics()).isTrue();
    }

    private VendorSubscription subscription(UUID vendorId, SubscriptionStatus status, String stripeSubscriptionId) {
        LocalDateTime now = LocalDateTime.now();
        return new VendorSubscription(
                UUID.randomUUID(), vendorId, PlanTier.FEATURED, status,
                "cus_123", stripeSubscriptionId, now, now.plusMonths(1),
                null, now, now, now);
    }

    private Vendor vendorWithViews(UUID id, int views) {
        return new Vendor(id, "Biz", null, null, null, "v@example.com", "hash",
                false, null, true, true, null, null, null, null, null,
                null, views, null, LocalDateTime.now(), LocalDateTime.now());
    }

    private List<Vendor> namedVendors(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> vendorNamed(String.format("Vendor %03d", i)))
                .toList();
    }

    private Vendor vendorNamed(String name) {
        return vendorNamedWithViews(name, 0);
    }

    private Vendor vendorNamedWithViews(String name, int views) {
        return new Vendor(UUID.randomUUID(), name, VendorCategory.PHOTOGRAPHER, "Austin", "TX",
                "v@example.com", "hash", false, null, true, true, null, null, null, null, null,
                null, views, null, LocalDateTime.now(), LocalDateTime.now());
    }

    private List<Vendor> activeVendors(int count) {
        List<Vendor> vendors = new ArrayList<>(count);
        IntStream.range(0, count).forEach(i -> vendors.add(vendorWithLogo(UUID.randomUUID(), null)));
        return vendors;
    }

    private Vendor vendorWithLogo(UUID id, String logoUrl) {
        return new Vendor(id, "Biz", null, null, null, "v@example.com", "hash",
                false, null, true, true, null, null, null, null, null,
                logoUrl, 0, null, LocalDateTime.now(), LocalDateTime.now());
    }

    private VendorPortfolioPhoto photo(UUID vendorId, String url) {
        return new VendorPortfolioPhoto(UUID.randomUUID(), vendorId, url, null, 0, LocalDateTime.now());
    }
}
