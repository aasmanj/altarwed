package com.altarwed.application.service;

import com.altarwed.application.dto.VendorPageResult;
import com.altarwed.domain.exception.VendorNotFoundException;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.model.VendorPortfolioPhoto;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.InquiryRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorRepository;
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
    // getVendors: server-side pagination, price-tier forwarding, and sort (issue #108)
    // -------------------------------------------------------------------------

    @Test
    void getVendors_returnsRequestedPageAndTotalAcrossAllMatches() {
        // 25 matches, page size 20: page 0 has 20, page 1 has the remaining 5; total is 25 on both.
        when(vendorRepository.findByFilters(null, null, null)).thenReturn(namedVendors(25));

        VendorPageResult page0 = vendorService.getVendors(null, null, null, "name", 0, 20);
        assertThat(page0.vendors()).hasSize(20);
        assertThat(page0.total()).isEqualTo(25);

        VendorPageResult page1 = vendorService.getVendors(null, null, null, "name", 1, 20);
        assertThat(page1.vendors()).hasSize(5);
        assertThat(page1.total()).isEqualTo(25);
    }

    @Test
    void getVendors_clampsPageSizeToFifty() {
        when(vendorRepository.findByFilters(null, null, null)).thenReturn(namedVendors(60));

        // A caller asking for size=1000 must never receive more than the 50-row page cap.
        VendorPageResult result = vendorService.getVendors(null, null, null, null, 0, 1000);

        assertThat(result.vendors()).hasSize(VendorService.MAX_PAGE_SIZE);
        assertThat(result.total()).isEqualTo(60);
    }

    @Test
    void getVendors_overpagedRequest_returnsEmptyPageButRealTotal() {
        when(vendorRepository.findByFilters(null, null, null)).thenReturn(namedVendors(3));

        // page 9 is past the end; the slice is empty but total still reflects every match.
        VendorPageResult result = vendorService.getVendors(null, null, null, "name", 9, 20);

        assertThat(result.vendors()).isEmpty();
        assertThat(result.total()).isEqualTo(3);
    }

    @Test
    void getVendors_sortName_ordersAlphabeticallyCaseInsensitive() {
        when(vendorRepository.findByFilters(null, null, null)).thenReturn(List.of(
                vendorNamed("Zion Films"),
                vendorNamed("aaron blooms"),
                vendorNamed("Mercy Catering")));

        VendorPageResult result = vendorService.getVendors(null, null, null, "name", 0, 20);

        assertThat(result.vendors())
                .extracting(Vendor::businessName)
                .containsExactly("aaron blooms", "Mercy Catering", "Zion Films");
    }

    @Test
    void getVendors_defaultSort_ordersByViewCountDescending() {
        when(vendorRepository.findByFilters(null, null, null)).thenReturn(List.of(
                vendorNamedWithViews("Low", 2),
                vendorNamedWithViews("High", 40),
                vendorNamedWithViews("Mid", 17)));

        VendorPageResult result = vendorService.getVendors(null, null, null, null, 0, 20);

        assertThat(result.vendors())
                .extracting(Vendor::businessName)
                .containsExactly("High", "Mid", "Low");
    }

    @Test
    void getVendors_forwardsCategoryCityAndPriceTierToRepository() {
        when(vendorRepository.findByFilters(VendorCategory.FLORIST, "Austin", "$$"))
                .thenReturn(namedVendors(2));

        VendorPageResult result =
                vendorService.getVendors(VendorCategory.FLORIST, "Austin", "$$", "name", 0, 20);

        assertThat(result.total()).isEqualTo(2);
        // The tier filter is server-side: the service forwards it to the repository unchanged.
        verify(vendorRepository).findByFilters(VendorCategory.FLORIST, "Austin", "$$");
    }

    @Test
    void getVendors_cappsTotalAtMaxSearchResults() {
        // Defensive second cap: even if a query path returns more than the directory cap,
        // the reported total never exceeds it.
        when(vendorRepository.findByFilters(null, null, null))
                .thenReturn(namedVendors(VendorRepository.MAX_SEARCH_RESULTS + 30));

        VendorPageResult result = vendorService.getVendors(null, null, null, "name", 0, 20);

        assertThat(result.total()).isEqualTo(VendorRepository.MAX_SEARCH_RESULTS);
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
