package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.DenominationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DenominationJpaRepository extends JpaRepository<DenominationEntity, UUID> {

    Optional<DenominationEntity> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
