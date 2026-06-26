package com.altarwed.application.service;

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

    @Test
    void search_blankFilter_capsResultsAtMaxSearchResults() {
        // A blank-filter directory request falls back to findAllActive(). If the table
        // has more rows than the cap, the public response must still be capped.
        when(vendorRepository.findAllActive()).thenReturn(activeVendors(VendorRepository.MAX_SEARCH_RESULTS + 50));

        List<Vendor> results = vendorService.search(null, null);

        assertThat(results).hasSize(VendorRepository.MAX_SEARCH_RESULTS);
    }

    @Test
    void search_filteredByCategory_capsResultsAtMaxSearchResults() {
        when(vendorRepository.findByCategory(VendorCategory.PHOTOGRAPHER))
                .thenReturn(activeVendors(VendorRepository.MAX_SEARCH_RESULTS + 10));

        List<Vendor> results = vendorService.search(null, VendorCategory.PHOTOGRAPHER);

        assertThat(results).hasSize(VendorRepository.MAX_SEARCH_RESULTS);
    }

    @Test
    void search_belowCap_returnsEverything() {
        when(vendorRepository.findAllActive()).thenReturn(activeVendors(7));

        List<Vendor> results = vendorService.search(null, null);

        assertThat(results).hasSize(7);
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
