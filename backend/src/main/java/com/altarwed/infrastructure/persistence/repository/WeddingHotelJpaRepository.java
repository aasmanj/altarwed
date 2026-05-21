package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingHotelEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeddingHotelJpaRepository extends JpaRepository<WeddingHotelEntity, UUID> {
    List<WeddingHotelEntity> findAllByWebsiteIdOrderBySortOrder(UUID websiteId);
    boolean existsByIdAndWebsiteId(UUID id, UUID websiteId);
}
