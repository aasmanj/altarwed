package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.persistence.entity.VendorEntity;
import com.altarwed.infrastructure.persistence.repository.VendorJpaRepository;
import lombok.RequiredArgsConstructor;
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

    @Override
    public List<Vendor> findByCity(String city) {
        return jpaRepository.findByCityIgnoreCase(city).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findByCityAndCategory(String city, VendorCategory category) {
        return jpaRepository.findByCityIgnoreCaseAndCategory(city, category)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findByCategory(VendorCategory category) {
        return jpaRepository.findByCategory(category).stream().map(this::toDomain).toList();
    }

    @Override
    public List<Vendor> findAllActive() {
        return jpaRepository.findAllByIsActiveTrue().stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
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
                .createdAt(v.createdAt())
                .updatedAt(v.updatedAt())
                .build();
    }
}
