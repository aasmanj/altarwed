package com.altarwed.application.service;

import com.altarwed.domain.exception.PortfolioCapExceededException;
import com.altarwed.domain.model.PlanTier;
import com.altarwed.domain.model.SubscriptionStatus;
import com.altarwed.domain.model.VendorPortfolioPhoto;
import com.altarwed.domain.model.VendorSubscription;
import com.altarwed.domain.port.VendorPortfolioPhotoRepository;
import com.altarwed.domain.port.VendorSubscriptionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Locks in the server-authoritative append position on
 * {@link VendorPortfolioPhotoService#addPhoto}: a new photo's sortOrder is max(sortOrder)+1,
 * not the photo count. After a middle photo is deleted the count no longer equals the next
 * free slot, so a count-based sortOrder would collide with an existing photo. The PHOTO_CAP
 * check still uses the count, which is correct for a cap.
 */
@ExtendWith(MockitoExtension.class)
class VendorPortfolioPhotoServiceTest {

    @Mock private VendorPortfolioPhotoRepository repository;
    @Mock private MediaUploadService mediaUploadService;
    @Mock private VendorSubscriptionRepository subscriptionRepository;

    private VendorPortfolioPhotoService service() {
        return new VendorPortfolioPhotoService(repository, mediaUploadService, subscriptionRepository);
    }

    private VendorSubscription subscription(UUID vendorId, PlanTier tier, SubscriptionStatus status) {
        return new VendorSubscription(
                UUID.randomUUID(), vendorId, tier, status,
                "cus_1", "sub_1", null, null, null, null, null, null);
    }

    private VendorPortfolioPhoto photo(UUID vendorId, int sortOrder) {
        return new VendorPortfolioPhoto(UUID.randomUUID(), vendorId, "https://x/p.png", null, sortOrder, null);
    }

    @Test
    void addPhoto_afterDeletingMiddlePhoto_appendsAtMaxSortOrderPlusOne_noCollision() throws Exception {
        UUID vendorId = UUID.randomUUID();
        // Portfolio started at sortOrder [0, 1, 2], the middle photo (sortOrder 1) was deleted,
        // so the surviving rows are [0, 2]. countByVendorId now returns 2, the colliding value
        // the old count-based logic would have reused.
        VendorPortfolioPhoto p0 = photo(vendorId, 0);
        VendorPortfolioPhoto p2 = photo(vendorId, 2);
        when(repository.countByVendorId(vendorId)).thenReturn(2);
        when(repository.findAllByVendorId(vendorId)).thenReturn(List.of(p0, p2));
        when(mediaUploadService.uploadVendorPortfolioPhoto(any(), any())).thenReturn("https://x/new.png");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().addPhoto(vendorId, mock(MultipartFile.class), "new caption");

        ArgumentCaptor<VendorPortfolioPhoto> captor = ArgumentCaptor.forClass(VendorPortfolioPhoto.class);
        verify(repository).save(captor.capture());
        int savedSortOrder = captor.getValue().sortOrder();
        // max(0, 2) + 1 = 3, not the old count-based 2.
        assertThat(savedSortOrder).isEqualTo(3);
        // The core acceptance criterion: it must not equal any surviving photo's sortOrder.
        assertThat(savedSortOrder).isNotIn(0, 2);
    }

    @Test
    void addPhoto_emptyPortfolio_startsAtZero() throws Exception {
        UUID vendorId = UUID.randomUUID();
        when(repository.countByVendorId(vendorId)).thenReturn(0);
        when(repository.findAllByVendorId(vendorId)).thenReturn(List.of());
        when(mediaUploadService.uploadVendorPortfolioPhoto(any(), any())).thenReturn("https://x/first.png");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().addPhoto(vendorId, mock(MultipartFile.class), null);

        ArgumentCaptor<VendorPortfolioPhoto> captor = ArgumentCaptor.forClass(VendorPortfolioPhoto.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().sortOrder()).isEqualTo(0);
    }

    @Test
    void addPhoto_atCap_isRejectedAndUploadsNothing() throws Exception {
        UUID vendorId = UUID.randomUUID();
        // The cap still keys off the count (10 photos = full), which is correct for a cap.
        when(repository.countByVendorId(vendorId)).thenReturn(10);

        assertThatThrownBy(() -> service().addPhoto(vendorId, mock(MultipartFile.class), null))
                .isInstanceOf(PortfolioCapExceededException.class);

        verify(mediaUploadService, never()).uploadVendorPortfolioPhoto(any(), any());
        verify(repository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // Issue #370 pricing ladder: tier-scoped portfolio cap (10 Basic/Pro, 25 Premium)
    // -------------------------------------------------------------------------

    @Test
    void addPhoto_activeProVendorAtTenPhotos_isStillRejected() {
        // Blank-ladder invariant: an ACTIVE Pro (FEATURED) subscription keeps the historical
        // cap of 10, so shipping the ladder changes nothing for every existing paying vendor.
        UUID vendorId = UUID.randomUUID();
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, PlanTier.FEATURED, SubscriptionStatus.ACTIVE)));
        when(repository.countByVendorId(vendorId)).thenReturn(10);

        assertThatThrownBy(() -> service().addPhoto(vendorId, mock(MultipartFile.class), null))
                .isInstanceOf(PortfolioCapExceededException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void addPhoto_activePremiumVendorAtTenPhotos_isAllowedUpToTwentyFive() throws Exception {
        UUID vendorId = UUID.randomUUID();
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, PlanTier.PREMIUM, SubscriptionStatus.ACTIVE)));
        when(repository.countByVendorId(vendorId)).thenReturn(10);
        when(repository.findAllByVendorId(vendorId)).thenReturn(List.of());
        when(mediaUploadService.uploadVendorPortfolioPhoto(any(), any())).thenReturn("https://x/p11.png");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().addPhoto(vendorId, mock(MultipartFile.class), null);

        verify(repository).save(any());
    }

    @Test
    void addPhoto_activePremiumVendorAtTwentyFivePhotos_isRejected() {
        UUID vendorId = UUID.randomUUID();
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, PlanTier.PREMIUM, SubscriptionStatus.ACTIVE)));
        when(repository.countByVendorId(vendorId)).thenReturn(25);

        assertThatThrownBy(() -> service().addPhoto(vendorId, mock(MultipartFile.class), null))
                .isInstanceOf(PortfolioCapExceededException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void addPhoto_lapsedPremiumVendorFallsBackToTheBaseCap() {
        // A CANCELLED Premium keeps its stored tier for history but its EFFECTIVE tier is
        // BASIC, so the 25-photo entitlement ends the moment the webhook downgrades it.
        UUID vendorId = UUID.randomUUID();
        when(subscriptionRepository.findByVendorId(vendorId))
                .thenReturn(Optional.of(subscription(vendorId, PlanTier.PREMIUM, SubscriptionStatus.CANCELLED)));
        when(repository.countByVendorId(vendorId)).thenReturn(10);

        assertThatThrownBy(() -> service().addPhoto(vendorId, mock(MultipartFile.class), null))
                .isInstanceOf(PortfolioCapExceededException.class);

        verify(repository, never()).save(any());
    }
}
