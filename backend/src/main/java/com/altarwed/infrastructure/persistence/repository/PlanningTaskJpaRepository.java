package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.PlanningTaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlanningTaskJpaRepository extends JpaRepository<PlanningTaskEntity, UUID> {
    List<PlanningTaskEntity> findAllByCoupleIdOrderBySortOrderAsc(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
    long countByCoupleId(UUID coupleId);
}
