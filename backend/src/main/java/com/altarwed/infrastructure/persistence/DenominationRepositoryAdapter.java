package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.Denomination;
import com.altarwed.domain.port.DenominationRepository;
import com.altarwed.infrastructure.persistence.entity.DenominationEntity;
import com.altarwed.infrastructure.persistence.repository.DenominationJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class DenominationRepositoryAdapter implements DenominationRepository {

    private final DenominationJpaRepository jpaRepository;

    @Override
    public Denomination save(Denomination denomination) {
        DenominationEntity saved = jpaRepository.save(toEntity(denomination));
        return toDomain(saved);
    }

    @Override
    public Optional<Denomination> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Denomination> findBySlug(String slug) {
        return jpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public List<Denomination> findAll() {
        return jpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public boolean existsBySlug(String slug) {
        return jpaRepository.existsBySlug(slug);
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private Denomination toDomain(DenominationEntity e) {
        return new Denomination(
                e.getId(),
                e.getName(),
                e.getSlug(),
                new ArrayList<>(e.getTraditions())
        );
    }

    private DenominationEntity toEntity(Denomination d) {
        return DenominationEntity.builder()
                .id(d.id())
                .name(d.name())
                .slug(d.slug())
                .traditions(new ArrayList<>(d.traditions()))
                .build();
    }
}
