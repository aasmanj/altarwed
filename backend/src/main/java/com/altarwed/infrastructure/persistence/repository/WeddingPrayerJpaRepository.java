package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingPrayerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeddingPrayerJpaRepository extends JpaRepository<WeddingPrayerEntity, UUID> {
    List<WeddingPrayerEntity> findAllByWeddingWebsiteIdOrderByCreatedAtDesc(UUID weddingWebsiteId);
    boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId);
}
