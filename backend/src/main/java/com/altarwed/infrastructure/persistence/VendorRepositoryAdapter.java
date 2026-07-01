package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

    // Deterministic directory orderings, applied by the database (issue #135). "name" is
    // alphabetical A-Z; the default is most-viewed first (a lightweight popularity proxy). Both
    // tie-break on the id primary key so a given filter+sort renders the same order every request
    // (without a total order, SQL Server may return equal-key rows in any order, so the capped
    // window would be unstable and some vendors could randomly never appear). Case-insensitivity
    // of business_name comes from SQL Server's default collation, so no LOWER() is applied to the
    // sort key, keeping it index-friendly.
    private static final Sort NAME_SORT = Sort.by(
            Sort.Order.asc("businessName"), Sort.Order.asc("id"));
    private static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.desc("viewCount"), Sort.Order.asc("businessName"), Sort.Order.asc("id"));

    private static Sort directorySort(String sort) {
        return "name".equalsIgnoreCase(sort) ? NAME_SORT : DEFAULT_SORT;
    }

    // Blank filter values ("", "  ") mean "no filter": normalize them to null so the query's
    // "(:x IS NULL OR ...)" branch short-circuits instead of matching on an empty string.
    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    @Override
    public List<Vendor> findDirectoryPage(VendorCategory category, String city, String priceTier,
                                          String sort, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, directorySort(sort));
        return jpaRepository.findDirectory(category, blankToNull(city), blankToNull(priceTier), pageable)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public long countDirectory(VendorCategory category, String city, String priceTier) {
        return jpaRepository.countDirectory(category, blankToNull(city), blankToNull(priceTier));
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
