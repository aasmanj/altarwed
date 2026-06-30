package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link VendorRepositoryAdapter#findByFilters}, the server-side price-tier
 * filter behind the paginated public directory (issue #108). The JPA repository is mocked so
 * the test runs in backend-test with no database: it asserts the adapter narrows the capped
 * candidate set to the requested tier and leaves it untouched when no tier is supplied.
 */
@ExtendWith(MockitoExtension.class)
class VendorRepositoryAdapterTest {

    @Mock private VendorJpaRepository jpaRepository;

    @Test
    void findByFilters_filtersByPriceTierServerSide() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        when(jpaRepository.findAllByIsActiveTrueAndIsVerifiedTrue(any(Pageable.class))).thenReturn(List.of(
                entity("Budget Blooms", "$"),
                entity("Grand Venue", "$$$"),
                entity("Mid Cake", "$$")));

        List<Vendor> result = adapter.findByFilters(null, null, "$$");

        assertThat(result).extracting(Vendor::businessName).containsExactly("Mid Cake");
    }

    @Test
    void findByFilters_noTier_returnsWholeCandidateSet() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        when(jpaRepository.findAllByIsActiveTrueAndIsVerifiedTrue(any(Pageable.class))).thenReturn(List.of(
                entity("Budget Blooms", "$"),
                entity("Grand Venue", "$$$")));

        List<Vendor> result = adapter.findByFilters(null, null, null);

        assertThat(result).hasSize(2);
    }

    @Test
    void findByFilters_blankTier_returnsWholeCandidateSet() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        when(jpaRepository.findAllByIsActiveTrueAndIsVerifiedTrue(any(Pageable.class)))
                .thenReturn(List.of(entity("Budget Blooms", "$")));

        List<Vendor> result = adapter.findByFilters(null, null, "  ");

        assertThat(result).hasSize(1);
    }

    private VendorEntity entity(String name, String priceTier) {
        return VendorEntity.builder()
                .id(UUID.randomUUID())
                .businessName(name)
                .category(VendorCategory.FLORIST)
                .city("Austin")
                .state("TX")
                .email(name.replace(' ', '.') + "@example.com")
                .passwordHash("hash")
                .isChristianOwned(true)
                .isActive(true)
                .isVerified(true)
                .priceTier(priceTier)
                .viewCount(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
