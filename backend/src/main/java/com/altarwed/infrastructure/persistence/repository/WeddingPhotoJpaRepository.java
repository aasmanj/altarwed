package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingPhotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeddingPhotoJpaRepository extends JpaRepository<WeddingPhotoEntity, UUID> {
    List<WeddingPhotoEntity> findAllByWeddingWebsiteIdOrderBySortOrderAsc(UUID weddingWebsiteId);
    boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId);
}
