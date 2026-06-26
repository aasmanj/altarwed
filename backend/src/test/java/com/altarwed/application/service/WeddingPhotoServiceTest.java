package com.altarwed.application.service;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
    void addPhoto_afterDelete_appendsAtMaxSortOrderPlusOne_noCollision() {
        UUID websiteId = UUID.randomUUID();
        // Started at sortOrder [0, 1, 2], the middle photo was deleted, so the surviving rows
        // are [0, 2]. The album count is now 2, the same value the stale client sends.
        WeddingPhoto p0 = photo(websiteId, 0);
        WeddingPhoto p2 = photo(websiteId, 2);
        when(websiteRepository.findById(websiteId)).thenReturn(Optional.of(mock(WeddingWebsite.class)));
        when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(p0, p2));
        when(photoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Client still sends the colliding count-based value of 2; the server must ignore it.
        AddWeddingPhotoRequest req = new AddWeddingPhotoRequest("https://x/new.png", null, 2);
        service().addPhoto(websiteId, req);

        ArgumentCaptor<WeddingPhoto> captor = ArgumentCaptor.forClass(WeddingPhoto.class);
        verify(photoRepository).save(captor.capture());
        // max(0, 2) + 1 = 3, not the client's colliding 2.
        assertThat(captor.getValue().sortOrder()).isEqualTo(3);
    }

    @Test
    void addPhoto_emptyAlbum_startsAtZero() {
        UUID websiteId = UUID.randomUUID();
        when(websiteRepository.findById(websiteId)).thenReturn(Optional.of(mock(WeddingWebsite.class)));
        when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        when(photoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AddWeddingPhotoRequest req = new AddWeddingPhotoRequest("https://x/first.png", null, 9);
        service().addPhoto(websiteId, req);

        ArgumentCaptor<WeddingPhoto> captor = ArgumentCaptor.forClass(WeddingPhoto.class);
        verify(photoRepository).save(captor.capture());
        assertThat(captor.getValue().sortOrder()).isEqualTo(0);
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
