package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingWebsiteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WeddingWebsiteJpaRepository extends JpaRepository<WeddingWebsiteEntity, UUID> {

    Optional<WeddingWebsiteEntity> findByCoupleId(UUID coupleId);

    Optional<WeddingWebsiteEntity> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsByCoupleId(UUID coupleId);
}
