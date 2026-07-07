package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingPartyMemberRequest;
import com.altarwed.domain.model.WeddingPartyMember;
import com.altarwed.domain.model.WeddingPartySide;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Locks in the IDOR-smuggle defense on {@link WeddingPartyMemberService#reorderMembers}:
 * a reorder may only contain member IDs that belong to the party, and a valid permutation
 * reassigns sortOrder by index.
 */
@ExtendWith(MockitoExtension.class)
class WeddingPartyMemberServiceTest {

    @Mock private WeddingPartyMemberRepository repository;
    // A real MediaUploadService wrapping a mocked BlobStoragePort, so the blob-cleanup tests assert
    // the actual delegation into deleteBlobBestEffort -> BlobStoragePort.delete, not a stubbed shim.
    @Mock private BlobStoragePort blobStorage;

    private WeddingPartyMemberService service() {
        return new WeddingPartyMemberService(repository, new MediaUploadService(blobStorage));
    }

    private WeddingPartyMember member(UUID websiteId, int sortOrder) {
        return new WeddingPartyMember(UUID.randomUUID(), websiteId, "Name", "Best Man", WeddingPartySide.GROOM,
                null, null, sortOrder, LocalDateTime.now(), LocalDateTime.now(), null, null, null);
    }

    private WeddingPartyMember memberWithPhoto(UUID websiteId, String photoUrl) {
        return new WeddingPartyMember(UUID.randomUUID(), websiteId, "Name", "Best Man", WeddingPartySide.GROOM,
                null, photoUrl, 0, LocalDateTime.now(), LocalDateTime.now(), null, null, null);
    }

    @Test
    void addMember_afterDelete_appendsAtMaxSortOrderPlusOne_noCollision() {
        UUID websiteId = UUID.randomUUID();
        // Started at sortOrder [0, 1, 2], the middle member was deleted, so the surviving
        // rows are [0, 2]. The list count is now 2, the same value the stale client sends.
        WeddingPartyMember m0 = member(websiteId, 0);
        WeddingPartyMember m2 = member(websiteId, 2);
        when(repository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(m0, m2));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Client still sends the colliding count-based value of 2; the server must ignore it.
        CreateWeddingPartyMemberRequest req = new CreateWeddingPartyMemberRequest(
                "New Member", "Groomsman", WeddingPartySide.GROOM, null, null, 2);
        service().addMember(websiteId, req);

        ArgumentCaptor<WeddingPartyMember> captor = ArgumentCaptor.forClass(WeddingPartyMember.class);
        verify(repository).save(captor.capture());
        // max(0, 2) + 1 = 3, not the client's colliding 2.
        assertThat(captor.getValue().sortOrder()).isEqualTo(3);
    }

    @Test
    void addMember_emptyParty_startsAtZero() {
        UUID websiteId = UUID.randomUUID();
        when(repository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CreateWeddingPartyMemberRequest req = new CreateWeddingPartyMemberRequest(
                "First Member", "Best Man", WeddingPartySide.GROOM, null, null, 7);
        service().addMember(websiteId, req);

        ArgumentCaptor<WeddingPartyMember> captor = ArgumentCaptor.forClass(WeddingPartyMember.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().sortOrder()).isEqualTo(0);
    }

    @Test
    void reorder_validPermutation_reassignsSortOrderByIndex() {
        UUID websiteId = UUID.randomUUID();
        WeddingPartyMember m0 = member(websiteId, 0);
        WeddingPartyMember m1 = member(websiteId, 1);
        when(repository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(m0, m1));

        service().reorderMembers(websiteId, List.of(m1.id(), m0.id()));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WeddingPartyMember>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).extracting(WeddingPartyMember::id, WeddingPartyMember::sortOrder)
                .containsExactlyInAnyOrder(tuple(m1.id(), 0), tuple(m0.id(), 1));
    }

    @Test
    void reorder_foreignId_isRejectedAndPersistsNothing() {
        UUID websiteId = UUID.randomUUID();
        WeddingPartyMember m0 = member(websiteId, 0);
        when(repository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(m0));

        assertThatThrownBy(() -> service().reorderMembers(websiteId, List.of(m0.id(), UUID.randomUUID())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).saveAll(any());
    }

    @Test
    void reorder_sizeMismatch_isRejectedAndPersistsNothing() {
        UUID websiteId = UUID.randomUUID();
        WeddingPartyMember m0 = member(websiteId, 0);
        WeddingPartyMember m1 = member(websiteId, 1);
        when(repository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of(m0, m1));

        assertThatThrownBy(() -> service().reorderMembers(websiteId, List.of(m0.id())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).saveAll(any());
    }

    // ---- Orphaned-blob cleanup on replace and delete (issue #101) ----

    @Test
    void updatePhotoUrl_replacingExistingPhoto_deletesPriorBlobAfterPersist() {
        UUID websiteId = UUID.randomUUID();
        String priorUrl = "https://blob.example/wedding-party/old.jpg";
        WeddingPartyMember existing = memberWithPhoto(websiteId, priorUrl);
        when(repository.findById(existing.id())).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().updatePhotoUrl(websiteId, existing.id(), "https://blob.example/wedding-party/new.jpg");

        // The new URL is still persisted...
        ArgumentCaptor<WeddingPartyMember> captor = ArgumentCaptor.forClass(WeddingPartyMember.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().photoUrl()).isEqualTo("https://blob.example/wedding-party/new.jpg");
        // ...and only the PRIOR blob is deleted (best-effort helper delegates to BlobStoragePort.delete).
        verify(blobStorage).delete(priorUrl);
    }

    @Test
    void updatePhotoUrl_memberHadNoPriorPhoto_deletesNothing() {
        UUID websiteId = UUID.randomUUID();
        WeddingPartyMember existing = memberWithPhoto(websiteId, null);
        when(repository.findById(existing.id())).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().updatePhotoUrl(websiteId, existing.id(), "https://blob.example/wedding-party/new.jpg");

        verify(repository).save(any());
        verify(blobStorage, never()).delete(anyString());
    }

    @Test
    void deleteMember_deletesRowAndItsBlob() {
        UUID websiteId = UUID.randomUUID();
        String url = "https://blob.example/wedding-party/member.jpg";
        WeddingPartyMember existing = memberWithPhoto(websiteId, url);
        when(repository.findById(existing.id())).thenReturn(Optional.of(existing));

        service().deleteMember(websiteId, existing.id());

        verify(repository).deleteById(existing.id());
        verify(blobStorage).delete(url);
    }

    @Test
    void deleteMember_memberHasNoPhoto_deletesNothingFromStorage() {
        UUID websiteId = UUID.randomUUID();
        WeddingPartyMember existing = memberWithPhoto(websiteId, null);
        when(repository.findById(existing.id())).thenReturn(Optional.of(existing));

        service().deleteMember(websiteId, existing.id());

        verify(repository).deleteById(existing.id());
        verify(blobStorage, never()).delete(anyString());
    }

    @Test
    void blobDeleteFailure_isBestEffort_doesNotPropagate() {
        UUID websiteId = UUID.randomUUID();
        String url = "https://blob.example/wedding-party/member.jpg";
        WeddingPartyMember existing = memberWithPhoto(websiteId, url);
        when(repository.findById(existing.id())).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // Storage throws on delete; the request path must swallow it (best-effort cleanup).
        doThrow(new RuntimeException("storage down")).when(blobStorage).delete(anyString());

        assertThatCode(() ->
                service().updatePhotoUrl(websiteId, existing.id(), "https://blob.example/wedding-party/new.jpg"))
                .doesNotThrowAnyException();
        assertThatCode(() -> service().deleteMember(websiteId, existing.id()))
                .doesNotThrowAnyException();
    }
}
