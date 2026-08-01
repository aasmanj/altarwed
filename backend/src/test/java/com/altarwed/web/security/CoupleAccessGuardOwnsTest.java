package com.altarwed.web.security;

import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the non-throwing ownership check added for the #536 draft gate.
 * Unlike assertOwnsWebsite (which throws AccessDeniedException -> 403), owns()
 * must stay quiet so callers can 404 a draft without confirming it exists.
 */
class CoupleAccessGuardOwnsTest {

    private final CoupleRepository coupleRepository = mock(CoupleRepository.class);
    private final WeddingWebsiteRepository websiteRepository = mock(WeddingWebsiteRepository.class);
    private final CoupleAccessGuard guard = new CoupleAccessGuard(coupleRepository, websiteRepository);

    private final UUID ownerCoupleId = UUID.randomUUID();

    @Test
    void owns_anonymous_false_withoutRepositoryLookup() {
        assertThat(guard.owns(ownerCoupleId, null)).isFalse();
        verify(coupleRepository, never()).findByEmail(any());
    }

    @Test
    void owns_unknownPrincipal_false() {
        when(coupleRepository.findByEmail("ghost@couple.test")).thenReturn(Optional.empty());
        assertThat(guard.owns(ownerCoupleId, "ghost@couple.test")).isFalse();
    }

    @Test
    void owns_differentCouple_false() {
        when(coupleRepository.findByEmail("other@couple.test"))
                .thenReturn(Optional.of(couple(UUID.randomUUID(), "other@couple.test")));
        assertThat(guard.owns(ownerCoupleId, "other@couple.test")).isFalse();
    }

    @Test
    void owns_owner_true() {
        when(coupleRepository.findByEmail("owner@couple.test"))
                .thenReturn(Optional.of(couple(ownerCoupleId, "owner@couple.test")));
        assertThat(guard.owns(ownerCoupleId, "owner@couple.test")).isTrue();
    }

    private Couple couple(UUID id, String email) {
        return new Couple(id, "Partner One", "Partner Two", email, "hash",
                null, null, null, false, true, LocalDateTime.now(), LocalDateTime.now());
    }
}
