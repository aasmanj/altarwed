package com.altarwed.application.service;

import com.altarwed.domain.model.WeddingPartyMember;
import com.altarwed.domain.model.WeddingPartySide;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
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

    private WeddingPartyMemberService service() {
        return new WeddingPartyMemberService(repository);
    }

    private WeddingPartyMember member(UUID websiteId, int sortOrder) {
        return new WeddingPartyMember(UUID.randomUUID(), websiteId, "Name", "Best Man", WeddingPartySide.GROOM,
                null, null, sortOrder, LocalDateTime.now(), LocalDateTime.now(), null, null, null);
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
}
