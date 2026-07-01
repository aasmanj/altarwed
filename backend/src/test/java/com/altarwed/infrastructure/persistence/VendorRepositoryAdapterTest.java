package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link VendorRepositoryAdapter}'s directory query path (issue #135). The JPA
 * repository is mocked so these run in backend-test with no database. They assert the adapter
 * pushes the filter, sort, and page slice DOWN into the query: it builds the correct deterministic
 * {@link Sort} (default = most-viewed, name = A-Z, both tie-broken on id), forwards the page/size
 * as a {@link Pageable}, and normalizes blank filters to null so the query's "(:x IS NULL OR ...)"
 * branch short-circuits. The actual ORDER BY / OFFSET behavior against a real SQL Server (and the
 * proof that a most-viewed vendor past position 100 surfaces) lives in the schema-validation
 * {@code VendorDirectoryQueryTest}; here we prove the delegation is correct.
 */
@ExtendWith(MockitoExtension.class)
class VendorRepositoryAdapterTest {

    @Mock private VendorJpaRepository jpaRepository;

    @Test
    void findDirectoryPage_defaultSort_ordersByViewsThenNameThenId_andPagesInDb() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(jpaRepository.findDirectory(isNull(), isNull(), isNull(), pageable.capture()))
                .thenReturn(List.of());

        // sort=null selects the default (most-viewed) order; page 2 size 30 must reach the DB.
        adapter.findDirectoryPage(null, null, null, null, 2, 30);

        Pageable p = pageable.getValue();
        assertThat(p.getPageNumber()).isEqualTo(2);
        assertThat(p.getPageSize()).isEqualTo(30);
        assertThat(p.getSort().toList()).containsExactly(
                Sort.Order.desc("viewCount"),
                Sort.Order.asc("businessName"),
                Sort.Order.asc("id"));
    }

    @Test
    void findDirectoryPage_nameSort_ordersAlphabeticallyThenId() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(jpaRepository.findDirectory(isNull(), isNull(), isNull(), pageable.capture()))
                .thenReturn(List.of());

        // "NAME" (any case) selects the alphabetical order.
        adapter.findDirectoryPage(null, null, null, "NAME", 0, 20);

        assertThat(pageable.getValue().getSort().toList()).containsExactly(
                Sort.Order.asc("businessName"),
                Sort.Order.asc("id"));
    }

    @Test
    void findDirectoryPage_blankCityAndTierNormalizedToNull() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        when(jpaRepository.findDirectory(eq(VendorCategory.FLORIST), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(List.of());

        // Blank city/tier mean "no filter": they must reach the query as null, not "" / "  ".
        adapter.findDirectoryPage(VendorCategory.FLORIST, "  ", "", "name", 0, 20);

        verify(jpaRepository).findDirectory(eq(VendorCategory.FLORIST), isNull(), isNull(), any(Pageable.class));
    }

    @Test
    void findDirectoryPage_nonBlankFiltersForwardedAsIs_andMapsToDomain() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        when(jpaRepository.findDirectory(eq(VendorCategory.CATERER), eq("Austin"), eq("$$"), any(Pageable.class)))
                .thenReturn(List.of(entity("Mercy Catering", "$$")));

        List<Vendor> result = adapter.findDirectoryPage(VendorCategory.CATERER, "Austin", "$$", "name", 1, 10);

        assertThat(result).extracting(Vendor::businessName).containsExactly("Mercy Catering");
        verify(jpaRepository).findDirectory(eq(VendorCategory.CATERER), eq("Austin"), eq("$$"), any(Pageable.class));
    }

    @Test
    void countDirectory_forwardsNormalizedFiltersToCountQuery() {
        VendorRepositoryAdapter adapter = new VendorRepositoryAdapter(jpaRepository);
        // Blank tier normalized to null; the count is a DB COUNT over all tier matches, not a
        // 100-row prefix, which is what keeps the reported total correct past 100 vendors.
        when(jpaRepository.countDirectory(isNull(), eq("Austin"), isNull())).thenReturn(7L);

        long total = adapter.countDirectory(null, "Austin", "  ");

        assertThat(total).isEqualTo(7L);
        verify(jpaRepository).countDirectory(isNull(), eq("Austin"), isNull());
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
