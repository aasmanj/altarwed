package com.altarwed.application.service;

import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Locks in the IDOR-smuggle defense on {@link WeddingPhotoService#reorderPhotos}: a
 * reorder may only contain photo IDs that belong to the album, and a valid permutation
 * reassigns sortOrder by index. A future refactor that drops the foreign-id rejection
 * would fail here.
 */
@ExtendWith(MockitoExtension.class)
class WeddingPhotoServiceTest {

    @Mock private WeddingPhotoRepository photoRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;

    private WeddingPhotoService service() {
        return new WeddingPhotoService(photoRepository, websiteRepository);
    }

    private WeddingPhoto photo(UUID websiteId, int sortOrder) {
        return new WeddingPhoto(UUID.randomUUID(), websiteId, "https://x/p.png", null, sortOrder, null, null, null, null);
    }

    @Test
    void reorder_validPermutation_reassignsSortOrderByIndex() {
        UUID websiteId = UUID.randomUUID();
        WeddingPhoto p0 = photo(websiteId, 0);
        WeddingPhoto p1 = photo(websiteId, 1);
        when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(p0, p1));

        // Move p1 to the front.
        service().reorderPhotos(websiteId, List.of(p1.id(), p0.id()));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WeddingPhoto>> captor = ArgumentCaptor.forClass(List.class);
        verify(photoRepository).saveAll(captor.capture());
        List<WeddingPhoto> saved = captor.getValue();
        assertThat(saved).extracting(WeddingPhoto::id, WeddingPhoto::sortOrder)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(p1.id(), 0),
                        org.assertj.core.groups.Tuple.tuple(p0.id(), 1));
    }

    @Test
    void reorder_foreignId_isRejectedAndPersistsNothing() {
        UUID websiteId = UUID.randomUUID();
        WeddingPhoto p0 = photo(websiteId, 0);
        when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(p0));

        // A photo id from another album smuggled into the batch.
        assertThatThrownBy(() -> service().reorderPhotos(websiteId, List.of(p0.id(), UUID.randomUUID())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(photoRepository, never()).saveAll(any());
    }

    @Test
    void reorder_sizeMismatch_isRejectedAndPersistsNothing() {
        UUID websiteId = UUID.randomUUID();
        WeddingPhoto p0 = photo(websiteId, 0);
        WeddingPhoto p1 = photo(websiteId, 1);
        when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(p0, p1));

        // Stale client: omits p1.
        assertThatThrownBy(() -> service().reorderPhotos(websiteId, List.of(p0.id())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(photoRepository, never()).saveAll(any());
    }
}
