package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorRepositoryAdapter implements VendorRepository {

    private final VendorJpaRepository jpaRepository;

    @Override
    public Vendor save(Vendor vendor) {
        VendorEntity saved = jpaRepository.save(toEntity(vendor));
        return toDomain(saved);
    }

    @Override
    public Optional<Vendor> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Vendor> findByEmail(String email) {
        return jpaRepository.findByEmail(email).map(this::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return jpaRepository.existsByEmail(email);
    }

    // Every public directory query is capped at the database so a blank-filter request
    // can never stream the whole active-vendor table (egress / DoS vector). The sort is
    // deterministic (business name, then the id primary key as a tiebreaker) so the capped
    // window is stable across requests: with no ORDER BY, SQL Server may return any 100 of
    // N rows in any order, and some verified vendors would randomly never appear.
    private static final PageRequest SEARCH_CAP = PageRequest.of(
            0, MAX_SEARCH_RESULTS,
            Sort.by(Sort.Direction.ASC, "businessName").and(Sort.by(Sort.Direction.ASC, "id")));

    @Override
    public List<Vendor> findByCity(String city) {
        return jpaRepository.findByCityIgnoreCaseAndIsActiveTrueAndIsVerifiedTrue(city, SEARCH_CAP)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findByCityAndCategory(String city, VendorCategory category) {
        return jpaRepository.findByCityIgnoreCaseAndCategoryAndIsActiveTrueAndIsVerifiedTrue(city, category, SEARCH_CAP)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findByCategory(VendorCategory category) {
        return jpaRepository.findByCategoryAndIsActiveTrueAndIsVerifiedTrue(category, SEARCH_CAP)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findAllActive() {
        return jpaRepository.findAllByIsActiveTrueAndIsVerifiedTrue(SEARCH_CAP).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findByFilters(VendorCategory category, String city, String priceTier) {
        boolean hasCity = city != null && !city.isBlank();
        List<Vendor> base;
        if (hasCity && category != null) {
            base = findByCityAndCategory(city, category);
        } else if (hasCity) {
            base = findByCity(city);
        } else if (category != null) {
            base = findByCategory(category);
        } else {
            base = findAllActive();
        }
        if (priceTier == null || priceTier.isBlank()) {
            return base;
        }
        // No DB-derived query exists for price tier, and adding one would multiply the
        // category/city query combinations. Filtering the already-capped candidate set in
        // memory keeps the tier filter server-side and is cheap at this scale: the cap above
        // bounds it at MAX_SEARCH_RESULTS rows.
        return base.stream().filter(v -> priceTier.equals(v.priceTier())).toList();
    }

    @Override
    public long countVerified() {
        return jpaRepository.countByIsVerifiedTrue();
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public void incrementViewCount(UUID id) {
        jpaRepository.incrementViewCount(id);
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private Vendor toDomain(VendorEntity e) {
        return new Vendor(
                e.getId(),
                e.getBusinessName(),
                e.getCategory(),
                e.getCity(),
                e.getState(),
                e.getEmail(),
                e.getPasswordHash(),
                e.isChristianOwned(),
                new ArrayList<>(e.getDenominationIds()),
                e.isActive(),
                e.isVerified(),
                e.getPriceTier(),
                e.getBio(),
                e.getDescription(),
                e.getWebsiteUrl(),
                e.getPhone(),
                e.getLogoUrl(),
                e.getViewCount(),
                e.getContactEmail(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }

    private VendorEntity toEntity(Vendor v) {
        return VendorEntity.builder()
                .id(v.id())
                .businessName(v.businessName())
                .category(v.category())
                .city(v.city())
                .state(v.state())
                .email(v.email())
                .passwordHash(v.passwordHash())
                .isChristianOwned(v.isChristianOwned())
                .denominationIds(new ArrayList<>(v.denominationIds()))
                .isActive(v.isActive())
                .isVerified(v.isVerified())
                .priceTier(v.priceTier())
                .bio(v.bio())
                .description(v.description())
                .websiteUrl(v.websiteUrl())
                .phone(v.phone())
                .logoUrl(v.logoUrl())
                .viewCount(v.viewCount() != null ? v.viewCount() : 0)
                .contactEmail(v.contactEmail())
                .createdAt(v.createdAt())
                .updatedAt(v.updatedAt())
                .build();
    }
}
