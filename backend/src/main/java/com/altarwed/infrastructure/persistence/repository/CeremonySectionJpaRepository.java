package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CeremonySectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CeremonySectionJpaRepository extends JpaRepository<CeremonySectionEntity, UUID> {
    List<CeremonySectionEntity> findByCoupleIdOrderBySortOrder(UUID coupleId);
}
